const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

const ROLES = {
  OWNER: 'Owner',
  ORG_ADMIN: 'Organization Admin',
  SITE_ADMIN: 'Site Admin',
};

async function getAppUser(req) {
  const firebaseUid = req.user?.uid;
  if (!firebaseUid) {
    logger.warn({ path: req.originalUrl }, 'getAppUser called without uid');
    return null;
  }
  const user = await prisma.users.findUnique({
    where: { firebaseUid },
    include: { role: true, userGroups: { include: { group: true } } },
  });
  logger.debug({ uid: firebaseUid, role: user?.role?.name, groups: (user?.userGroups || []).length }, 'Loaded app user');
  return user;
}

function hasRole(user, roleName) {
  const match = user?.role?.name === roleName;
  logger.debug({ uid: user?.firebaseUid, expected: roleName, actual: user?.role?.name, match }, 'hasRole check');
  return match;
}

async function canManageBuilding(user, buildingId) {
  if (!user) {
    logger.warn({ buildingId }, 'canManageBuilding: no user');
    return false;
  }
  if (hasRole(user, ROLES.OWNER)) {
    logger.debug({ uid: user.firebaseUid, buildingId }, 'Owner can manage building');
    return true;
  }

  const biBuildingId = BigInt(String(buildingId));
  const groupIds = (user.userGroups || []).map(ug => ug.groupId);
  if (groupIds.length === 0) {
    logger.debug({ uid: user.firebaseUid, buildingId }, 'No groups; cannot manage building');
    return false;
  }

  if (hasRole(user, ROLES.ORG_ADMIN) || hasRole(user, ROLES.SITE_ADMIN)) {
    const gp = await prisma.globalPermissions.findFirst({
      where: { buildingId: biBuildingId, groupId: { in: groupIds } },
      select: { id: true },
    });
    const allowed = !!gp;
    logger.debug({ uid: user.firebaseUid, buildingId, allowed }, 'canManageBuilding decision');
    return allowed;
  }

  logger.debug({ uid: user.firebaseUid, buildingId }, 'Role not allowed for building management');
  return false;
}

async function canManageFloor(user, floorId) {
  if (!user) {
    logger.warn({ floorId }, 'canManageFloor: no user');
    return false;
  }
  if (hasRole(user, ROLES.OWNER)) {
    logger.debug({ uid: user.firebaseUid, floorId }, 'Owner can manage floor');
    return true;
  }

  const floor = await prisma.floors.findUnique({
    where: { id: BigInt(String(floorId)) },
    select: { id: true, buildingId: true },
  });
  if (!floor) {
    logger.debug({ uid: user.firebaseUid, floorId }, 'Floor not found; cannot manage');
    return false;
  }

  const groupIds = (user.userGroups || []).map(ug => ug.groupId);
  if (groupIds.length === 0) {
    logger.debug({ uid: user.firebaseUid, floorId }, 'No groups; cannot manage floor');
    return false;
  }

  if (hasRole(user, ROLES.ORG_ADMIN)) {
    const gp = await prisma.globalPermissions.findFirst({
      where: { floorId: floor.id, groupId: { in: groupIds } },
      select: { id: true },
    });
    const allowed = !!gp;
    logger.debug({ uid: user.firebaseUid, floorId, allowed, rule: 'strict-floor' }, 'canManageFloor decision');
    return allowed;
  }

  if (hasRole(user, ROLES.SITE_ADMIN)) {
    const gp = await prisma.globalPermissions.findFirst({
      where: { buildingId: floor.buildingId, groupId: { in: groupIds } },
      select: { id: true },
    });
    const allowed = !!gp;
    logger.debug({ uid: user.firebaseUid, floorId, allowed, viaBuildingId: String(floor.buildingId) }, 'canManageFloor (site admin via building) decision');
    return allowed;
  }

  logger.debug({ uid: user.firebaseUid, floorId }, 'Role not allowed for floor management');
  return false;
}

module.exports = { ROLES, getAppUser, hasRole, canManageBuilding, canManageFloor };
