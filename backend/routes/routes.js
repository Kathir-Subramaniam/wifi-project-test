const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const firebaseAuthController = require('../controllers/firebase-auth-controller');
const verifyToken = require('../middleware');
const PostsController = require('../controllers/posts-controller.js');
const { admin } = require('../config/firebase');
const { getAppUser, canManageBuilding, canManageFloor } = require('../controllers/rbac');
const logger = require('../utils/logger');
const { authLimiter, resetPasswordLimiter, adminLimiter } = require('../utils/rateLimiters');

// Helpers
const toBi = (v) => {
  const s = String(v);
  if (!/^\d+$/.test(s)) throw new Error(`Invalid ID: ${s}`);
  return BigInt(s);
};

// Auth routes
router.post('/api/register', authLimiter, (req, res) => {
  logger.info({ email: req.body?.email }, 'Register requested');
  return firebaseAuthController.registerUser(req, res);
});
router.post('/api/login', authLimiter, (req, res) => {
  logger.info({ email: req.body?.email }, 'Login requested');
  return firebaseAuthController.loginUser(req, res);
});
router.post('/api/logout', (req, res) => {
  logger.info({ uid: req.user?.uid }, 'Logout requested');
  return firebaseAuthController.logoutUser(req, res);
});
router.post('/api/reset-password', resetPasswordLimiter, (req, res) => {
  logger.info({ email: req.body?.email }, 'Password reset requested');
  return firebaseAuthController.resetPassword(req, res);
});

router.use('/api/admin', adminLimiter);

// Groups
router.get('/api/admin/groups', verifyToken, async (req, res) => {
  try {
    logger.debug({ uid: req.user?.uid }, 'List groups');
    const gs = await prisma.groups.findMany({ orderBy: { id: 'asc' } });
    logger.info({ uid: req.user?.uid, count: gs.length }, 'Groups listed');
    res.json(gs.map((g) => ({ id: g.id.toString(), name: g.name })));
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'List groups failed');
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

router.post('/api/admin/groups', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      logger.warn({ uid: req.user?.uid }, 'Create group: missing name');
      return res.status(400).json({ error: 'name required' });
    }
    const g = await prisma.groups.create({ data: { name } });
    logger.info({ uid: req.user?.uid, id: String(g.id), name }, 'Group created');
    res.json({ id: g.id.toString(), name: g.name });
  } catch (e) {
    const msg = /Unique|unique/.test(e.message) ? 'Group already exists' : 'Failed to create group';
    logger.error({ err: e, uid: req.user?.uid }, 'Create group failed');
    res.status(400).json({ error: msg });
  }
});

router.put('/api/admin/groups/:id', verifyToken, async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const { name } = req.body;
    const g = await prisma.groups.update({ where: { id }, data: { name } });
    logger.info({ uid: req.user?.uid, id: String(id) }, 'Group updated');
    res.json({ id: g.id.toString(), name: g.name });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'Update group failed');
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/api/admin/groups/:id', verifyToken, async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    await prisma.groups.delete({ where: { id } });
    logger.warn({ uid: req.user?.uid, id: String(id) }, 'Group deleted');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'Delete group failed');
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// GlobalPermissions
router.get('/api/admin/global-permissions', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'GlobalPermissions unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const roleName = user?.role?.name || '';
    logger.debug({ uid: req.user?.uid, role: roleName }, 'List GlobalPermissions');

    if (roleName === 'Owner') {
      const rows = await prisma.globalPermissions.findMany({
        include: { group: true, building: true, floor: true },
        orderBy: { id: 'asc' },
      });
      logger.info({ uid: req.user?.uid, count: rows.length }, 'GlobalPermissions listed for owner');
      return res.json(rows.map(rec => ({
        id: String(rec.id),
        groupId: String(rec.groupId),
        buildingId: String(rec.buildingId),
        floorId: String(rec.floorId),
        groupName: rec.group?.name || null,
        buildingName: rec.building?.name || null,
        floorName: rec.floor?.name || null,
      })));
    }
  

    if (roleName === 'Organization Admin') {
      const myGroupIds = (user.userGroups || []).map(ug => ug.groupId);
      if (myGroupIds.length === 0) {
        logger.info({ uid: req.user?.uid }, 'GlobalPermissions empty: org admin has no groups');
        return res.json([]);
      }
      const rows = await prisma.globalPermissions.findMany({
        where: { groupId: { in: myGroupIds } },
        include: { group: true, building: true, floor: true },
        orderBy: { id: 'asc' },
      });
      logger.info({ uid: req.user?.uid, count: rows.length }, 'GlobalPermissions listed for org admin');
      return res.json(rows.map(rec => ({
        id: String(rec.id),
        groupId: String(rec.groupId),
        buildingId: String(rec.buildingId),
        floorId: String(rec.floorId),
        groupName: rec.group?.name || null,
        buildingName: rec.building?.name || null,
        floorName: rec.floor?.name || null,
      })));
    }

    logger.warn({ uid: req.user?.uid, role: roleName }, 'GlobalPermissions forbidden: role not allowed');
    return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/admin/global-permissions error');
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/api/admin/global-permissions', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Create GP unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const roleName = user?.role?.name || '';

    const { groupId, buildingId, floorId } = req.body || {};
    if (!groupId || !buildingId || !floorId) {
      logger.warn({ uid: req.user?.uid }, 'Create GP: missing fields');
      return res.status(400).json({ error: 'groupId, buildingId, floorId required' });
    }

    const [group, building, floor] = await Promise.all([
      prisma.groups.findUnique({ where: { id: toBi(groupId) }, select: { id: true, name: true } }),
      prisma.buildings.findUnique({ where: { id: toBi(buildingId) }, select: { id: true, name: true } }),
      prisma.floors.findUnique({ where: { id: toBi(floorId) }, select: { id: true, name: true, buildingId: true } }),
    ]);
    if (!group || !building || !floor || String(floor.buildingId) !== String(toBi(buildingId))) {
      logger.warn({ uid: req.user?.uid, groupId, buildingId, floorId }, 'Create GP: invalid FK or mismatched building-floor');
      return res.status(400).json({ error: 'Invalid groupId/buildingId/floorId (or floor not in building)' });
    }

    if (roleName === 'Owner') {
      // Owner is authorized
    } else if (roleName === 'Organization Admin') {
      const myGroupIds = (user.userGroups || []).map(ug => String(ug.groupId));
      if (!myGroupIds.includes(String(toBi(groupId)))) {
        logger.warn({ uid: req.user?.uid, role: roleName, groupId }, 'Create GP forbidden: group not in org admin scope');
        return res.status(403).json({ error: 'Forbidden: group is not in your scope' });
      }
      
    } else {
      logger.warn({ uid: req.user?.uid, role: roleName }, 'Create GP forbidden: role not allowed');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const created = await prisma.globalPermissions.create({
      data: {
        groupId: toBi(groupId),
        buildingId: toBi(buildingId),
        floorId: toBi(floorId),
      },
      include: { group: true, building: true, floor: true },
    });

    logger.info({ uid: req.user?.uid, id: String(created.id) }, 'GlobalPermission created');
    return res.json({
      id: created.id.toString(),
      groupId: created.groupId.toString(),
      groupName: created.group?.name || null,
      buildingId: created.buildingId.toString(),
      buildingName: created.building?.name || null,
      floorId: created.floorId.toString(),
      floorName: created.floor?.name || null,
    });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'Create GlobalPermission failed');
    return res.status(500).json({ error: 'Failed to create global permission' });
  }
});

router.delete('/api/admin/global-permissions/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Delete GP unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const roleName = user?.role?.name || '';
    const id = toBi(req.params.id);

    const existing = await prisma.globalPermissions.findUnique({
      where: { id },
      select: { id: true, groupId: true },
    });
    if (!existing) {
      logger.warn({ uid: req.user?.uid, id: String(id) }, 'Delete GP: not found');
      return res.status(404).json({ error: 'GlobalPermission not found' });
    }

    if (roleName === 'Owner') {
      // Owner Authorized
    } else if (roleName === 'Organization Admin') {
      const myGroupIds = (user.userGroups || []).map(ug => String(ug.groupId));
      if (!myGroupIds.includes(String(existing.groupId))) {
        logger.warn({ uid: req.user?.uid, role: roleName, gpGroupId: String(existing.groupId) }, 'Delete GP forbidden: group not in org admin scope');
        return res.status(403).json({ error: 'Forbidden: GlobalPermission group is not in your scope' });
      }
    } else {
      logger.warn({ uid: req.user?.uid, role: roleName }, 'Delete GP forbidden: role not allowed');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.globalPermissions.delete({ where: { id } });
    logger.info({ uid: req.user?.uid, id: String(id) }, 'GlobalPermission deleted');
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'Delete GlobalPermission failed');
    return res.status(500).json({ error: 'Failed to delete global permission' });
  }
});

// router.post('/api/admin/global-permissions', verifyToken, async (req, res) => {
//   try {
//     const { groupId, buildingId, floorId } = req.body;
//     if (!groupId || !buildingId || !floorId) {
//       logger.warn({ uid: req.user?.uid }, 'Create GP: missing fields');
//       return res.status(400).json({ error: 'groupId, buildingId, floorId required' });
//     }
//     const created = await prisma.globalPermissions.create({
//       data: { groupId: toBi(groupId), buildingId: toBi(buildingId), floorId: toBi(floorId) },
//       include: { group: true, building: true, floor: true },
//     });
//     logger.info({ uid: req.user?.uid, id: String(created.id) }, 'GlobalPermission created');
//     res.json({
//       id: created.id.toString(),
//       groupId: created.groupId.toString(),
//       groupName: created.group?.name || null,
//       buildingId: created.buildingId.toString(),
//       buildingName: created.building?.name || null,
//       floorId: created.floorId.toString(),
//       floorName: created.floor?.name || null,
//     });
//   } catch (e) {
//     logger.error({ err: e, uid: req.user?.uid }, 'Create GlobalPermission failed');
//     res.status(500).json({ error: 'Failed to create global permission' });
//   }
// });

// router.delete('/api/admin/global-permissions/:id', verifyToken, async (req, res) => {
//   try {
//     const id = BigInt(req.params.id);
//     await prisma.globalPermissions.delete({ where: { id } });
//     logger.warn({ uid: req.user?.uid, id: String(id) }, 'GlobalPermission deleted');
//     res.json({ ok: true });
//   } catch (e) {
//     logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'Delete GlobalPermission failed');
//     res.status(500).json({ error: 'Failed to delete global permission' });
//   }
// });

// Buildings
router.get('/api/admin/buildings', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'List buildings unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name || '';
    let buildings = [];

    logger.debug({ uid: req.user?.uid, role }, 'List buildings');

    if (role === 'Owner') {
      buildings = await prisma.buildings.findMany({ orderBy: { id: 'asc' } });
    } else if (role === 'Organization Admin' || role === 'Site Admin') {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.info({ uid: req.user?.uid, role }, 'No buildings: no groups');
        return res.json([]);
      }
      buildings = await prisma.buildings.findMany({
        where: { globalPermissions: { some: { groupId: { in: groupIds } } } },
        orderBy: { id: 'asc' },
      });
    } else {
      logger.info({ uid: req.user?.uid, role }, 'No buildings: role not allowed');
      return res.json([]);
    }

    logger.info({ uid: req.user?.uid, count: buildings.length }, 'Buildings listed');
    res.json(buildings.map((b) => ({ id: b.id.toString(), name: b.name })));
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/admin/buildings failed');
    res.status(500).json({ error: 'Failed to list buildings' });
  }
});

router.post('/api/admin/buildings', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Create building unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (user.role?.name !== 'Owner') {
      logger.warn({ uid: req.user?.uid, role: user.role?.name }, 'Create building forbidden');
      return res.status(403).json({ error: 'Only Owner can create buildings' });
    }

    const { name } = req.body;
    if (!name) {
      logger.warn({ uid: req.user?.uid }, 'Create building: missing name');
      return res.status(400).json({ error: 'name required' });
    }

    const b = await prisma.buildings.create({ data: { name } });
    logger.info({ uid: req.user?.uid, id: String(b.id), name }, 'Building created');
    res.json({ id: b.id.toString(), name: b.name });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'POST /api/admin/buildings failed');
    res.status(500).json({ error: 'Failed to create building' });
  }
});

router.put('/api/admin/buildings/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    const id = req.params.id;
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Update building unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (user.role?.name !== 'Owner') {
      logger.warn({ uid: req.user?.uid, role: user.role?.name }, 'Update building forbidden');
      return res.status(403).json({ error: 'Only Owner can Edit Building' });
    }

    const { name } = req.body;
    const b = await prisma.buildings.update({ where: { id: toBi(id) }, data: { name } });
    logger.info({ uid: req.user?.uid, id }, 'Building updated');
    res.json({ id: b.id.toString(), name: b.name });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'PUT /api/admin/buildings/:id failed');
    res.status(500).json({ error: 'Failed to update building' });
  }
});

router.delete('/api/admin/buildings/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    const id = req.params.id;
    if (!user || user.role?.name !== 'Owner') {
      logger.warn({ uid: req.user?.uid, role: user?.role?.name }, 'Delete building forbidden');
      return res.status(403).json({ error: 'Only Owner can delete buildings' });
    }

    await prisma.buildings.delete({ where: { id: toBi(id) } });
    logger.warn({ uid: req.user?.uid, id }, 'Building deleted');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'DELETE /api/admin/buildings/:id failed');
    res.status(500).json({ error: 'Failed to delete building' });
  }
});

// Floors
router.get('/api/admin/floors', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'List floors unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name || '';
    let floors = [];

    logger.debug({ uid: req.user?.uid, role }, 'List floors');

    if (role === 'Owner') {
      floors = await prisma.floors.findMany({ include: { building: true }, orderBy: { id: 'asc' } });
    } else if (role === 'Organization Admin' || role === 'Site Admin') {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.info({ uid: req.user?.uid, role }, 'No floors: no groups');
        return res.json([]);
      }

      floors = await prisma.floors.findMany({
        where: { globalPermissions: { some: { groupId: { in: groupIds } } } },
        include: { building: true },
        orderBy: { id: 'asc' },
      });
    } else {
      logger.info({ uid: req.user?.uid, role }, 'No floors: role not allowed');
      return res.json([]);
    }

    const payload = floors.map((f) => ({
      id: f.id.toString(),
      name: f.name,
      buildingId: f.buildingId.toString(),
      buildingName: f.building?.name ?? null,
    }));

    logger.info({ uid: req.user?.uid, count: payload.length }, 'Floors listed');
    res.json(payload);
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/admin/floors failed');
    res.status(500).json({ error: 'Failed to list floors' });
  }
});

router.post('/api/admin/floors', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Create floor unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name;
    const { name, svgMap, buildingId } = req.body;
    if (!name || !svgMap || !buildingId) {
      logger.warn({ uid: req.user?.uid }, 'Create floor: missing fields');
      return res.status(400).json({ error: 'name, svgMap, buildingId required' });
    }

    if (role === 'Site Admin') {
      logger.warn({ uid: req.user?.uid }, 'Create floor forbidden: site admin');
      return res.status(403).json({ error: 'Site Admins cannot create floors' });
    }

    const firstGroupId = (user.userGroups || [])[0]?.groupId;

    if (role === 'Owner') {
      const result = await prisma.$transaction(async (tx) => {
        const floor = await tx.floors.create({ data: { name, svgMap, buildingId: toBi(buildingId) } });
        if (firstGroupId) {
          await tx.globalPermissions.create({
            data: { groupId: firstGroupId, buildingId: toBi(buildingId), floorId: floor.id },
          });
        }
        return floor;
      });

      logger.info({ uid: req.user?.uid, id: String(result.id), buildingId: String(buildingId) }, 'Floor created (owner)');
      return res.json({ id: result.id.toString(), name: result.name, buildingId: result.buildingId.toString() });
    }

    if (role === 'Organization Admin') {
      const ok = await canManageBuilding(user, buildingId);
      if (!ok) {
        logger.warn({ uid: req.user?.uid, buildingId: String(buildingId) }, 'Create floor forbidden: org admin cannot manage building');
        return res.status(403).json({ error: 'Forbidden for building' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const floor = await tx.floors.create({ data: { name, svgMap, buildingId: toBi(buildingId) } });
        if (firstGroupId) {
          await tx.globalPermissions.create({
            data: { groupId: firstGroupId, buildingId: toBi(buildingId), floorId: floor.id },
          });
        }
        return floor;
      });

      logger.info({ uid: req.user?.uid, id: String(result.id), buildingId: String(buildingId) }, 'Floor created (org admin)');
      return res.json({ id: result.id.toString(), name: result.name, buildingId: result.buildingId.toString() });
    }

    logger.warn({ uid: req.user?.uid, role }, 'Create floor forbidden: role not allowed');
    return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'POST /api/admin/floors failed');
    res.status(500).json({ error: 'Failed to create floor' });
  }
});

router.put('/api/admin/floors/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    const id = req.params.id;
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Update floor unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name;

    if (role === 'Site Admin') {
      logger.warn({ uid: req.user?.uid }, 'Update floor forbidden: site admin');
      return res.status(403).json({ error: 'Site Admins cannot edit floors' });
    }

    if (role !== 'Owner' && !(await canManageFloor(user, id))) {
      logger.warn({ uid: req.user?.uid, floorId: id }, 'Update floor forbidden: not scoped');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, svgMap } = req.body;
    const f = await prisma.floors.update({
      where: { id: toBi(id) },
      data: { ...(name && { name }), ...(svgMap && { svgMap }) },
    });

    logger.info({ uid: req.user?.uid, id }, 'Floor updated');
    res.json({ id: f.id.toString(), name: f.name });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'PUT /api/admin/floors/:id failed');
    res.status(500).json({ error: 'Failed to update floor' });
  }
});

router.delete('/api/admin/floors/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    const id = req.params.id;
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Delete floor unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name;

    if (role === 'Site Admin') {
      logger.warn({ uid: req.user?.uid }, 'Delete floor forbidden: site admin');
      return res.status(403).json({ error: 'Site Admins cannot delete floors' });
    }

    if (role !== 'Owner' && !(await canManageFloor(user, id))) {
      logger.warn({ uid: req.user?.uid, floorId: id }, 'Delete floor forbidden: not scoped');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.floors.delete({ where: { id: toBi(id) } });
    logger.warn({ uid: req.user?.uid, id }, 'Floor deleted');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'DELETE /api/admin/floors/:id failed');
    res.status(500).json({ error: 'Failed to delete floor' });
  }
});

// APs
router.get('/api/admin/aps', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'List APs unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name || '';
    logger.debug({ uid: req.user?.uid, role }, 'List APs');

    if (role === 'Owner') {
      const aps = await prisma.aPs.findMany({ include: { floor: { include: { building: true } } }, orderBy: { id: 'asc' } });
      logger.info({ uid: req.user?.uid, count: aps.length }, 'APs listed for owner');
      return res.json(aps.map((ap) => ({
        id: ap.id.toString(),
        name: ap.name,
        cx: ap.cx,
        cy: ap.cy,
        floorId: ap.floorId.toString(),
        buildingId: ap.floor.buildingId.toString(),
      })));
    }

    if (role === 'Organization Admin' || role === 'Site Admin') {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.info({ uid: req.user?.uid }, 'APs empty: no groups');
        return res.json([]);
      }
      const aps = await prisma.aPs.findMany({
        where: { floor: { globalPermissions: { some: { groupId: { in: groupIds } } } } },
        include: { floor: { include: { building: true } } },
        orderBy: { id: 'asc' },
      });
      logger.info({ uid: req.user?.uid, count: aps.length }, 'APs listed for admin');
      return res.json(aps.map((ap) => ({
        id: ap.id.toString(),
        name: ap.name,
        cx: ap.cx,
        cy: ap.cy,
        floorId: ap.floorId.toString(),
        buildingId: ap.floor.buildingId.toString(),
      })));
    }

    logger.info({ uid: req.user?.uid, role }, 'APs empty: role not allowed');
    return res.json([]);
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/admin/aps failed');
    res.status(500).json({ error: 'Failed to list APs' });
  }
});

router.post('/api/admin/aps', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Create AP unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, cx, cy, floorId } = req.body;
    if (!name || cx == null || cy == null || !floorId) {
      logger.warn({ uid: req.user?.uid }, 'Create AP: missing fields');
      return res.status(400).json({ error: 'name, cx, cy, floorId required' });
    }

    if (!(await canManageFloor(user, floorId))) {
      logger.warn({ uid: req.user?.uid, floorId }, 'Create AP forbidden: cannot manage floor');
      return res.status(403).json({ error: 'Forbidden for floor' });
    }

    const ap = await prisma.aPs.create({ data: { name, cx: Number(cx), cy: Number(cy), floorId: toBi(floorId) } });
    logger.info({ uid: req.user?.uid, id: String(ap.id), floorId }, 'AP created');
    res.json({ id: ap.id.toString(), name: ap.name });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'POST /api/admin/aps failed');
    res.status(500).json({ error: 'Failed to create AP' });
  }
});

router.put('/api/admin/aps/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Update AP unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const apId = req.params.id;
    const ap = await prisma.aPs.findUnique({ where: { id: toBi(apId) } });
    if (!ap) {
      logger.warn({ uid: req.user?.uid, apId }, 'Update AP not found');
      return res.status(404).json({ error: 'AP not found' });
    }
    if (!(await canManageFloor(user, ap.floorId))) {
      logger.warn({ uid: req.user?.uid, floorId: String(ap.floorId) }, 'Update AP forbidden: cannot manage floor');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, cx, cy } = req.body;
    const updated = await prisma.aPs.update({
      where: { id: toBi(apId) },
      data: {
        ...(name && { name }),
        ...(cx != null && { cx: Number(cx) }),
        ...(cy != null && { cy: Number(cy) }),
      },
    });

    logger.info({ uid: req.user?.uid, id: apId }, 'AP updated');
    res.json({ id: updated.id.toString(), name: updated.name });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'PUT /api/admin/aps/:id failed');
    res.status(500).json({ error: 'Failed to update AP' });
  }
});

router.delete('/api/admin/aps/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Delete AP unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const apId = req.params.id;
    const ap = await prisma.aPs.findUnique({ where: { id: toBi(apId) } });
    if (!ap) {
      logger.warn({ uid: req.user?.uid, apId }, 'Delete AP not found');
      return res.status(404).json({ error: 'AP not found' });
    }
    if (!(await canManageFloor(user, ap.floorId)) && user.role?.name !== 'Owner') {
      logger.warn({ uid: req.user?.uid, floorId: String(ap.floorId) }, 'Delete AP forbidden: not scoped');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.aPs.delete({ where: { id: toBi(apId) } });
    logger.warn({ uid: req.user?.uid, id: apId }, 'AP deleted');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'DELETE /api/admin/aps/:id failed');
    res.status(500).json({ error: 'Failed to delete AP' });
  }
});

// Devices (Clients)
router.get('/api/admin/devices', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'List devices unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const role = user.role?.name || '';
    logger.debug({ uid: req.user?.uid, role }, 'List devices');

    if (role === 'Owner') {
      const devices = await prisma.clients.findMany({
        include: { ap: { include: { floor: { include: { building: true } } } } },
        orderBy: { id: 'asc' },
      });
      logger.info({ uid: req.user?.uid, count: devices.length }, 'Devices listed for owner');
      return res.json(devices.map((d) => ({
        id: d.id.toString(),
        mac: d.mac,
        apId: d.apId.toString(),
        floorId: d.ap.floorId.toString(),
        buildingId: d.ap.floor.buildingId.toString(),
        createdAt: d.createdAt,
      })));
    }

    if (role === 'Organization Admin' || role === 'Site Admin') {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.info({ uid: req.user?.uid }, 'Devices empty: no groups');
        return res.json([]);
      }
      const devices = await prisma.clients.findMany({
        where: { ap: { floor: { globalPermissions: { some: { groupId: { in: groupIds } } } } } },
        include: { ap: { include: { floor: { include: { building: true } } } } },
        orderBy: { id: 'asc' },
      });
      logger.info({ uid: req.user?.uid, count: devices.length }, 'Devices listed for admin');
      return res.json(devices.map((d) => ({
        id: d.id.toString(),
        mac: d.mac,
        apId: d.apId.toString(),
        floorId: d.ap.floorId.toString(),
        buildingId: d.ap.floor.buildingId.toString(),
        createdAt: d.createdAt,
      })));
    }

    logger.info({ uid: req.user?.uid, role }, 'Devices empty: role not allowed');
    return res.json([]);
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/admin/devices failed');
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

router.post('/api/admin/devices', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Create device unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { mac, apId } = req.body;
    if (!mac || !apId) {
      logger.warn({ uid: req.user?.uid }, 'Create device: missing fields');
      return res.status(400).json({ error: 'mac and apId required' });
    }

    const ap = await prisma.aPs.findUnique({ where: { id: toBi(apId) } });
    if (!ap) {
      logger.warn({ uid: req.user?.uid, apId }, 'Create device: AP not found');
      return res.status(404).json({ error: 'AP not found' });
    }
    if (!(await canManageFloor(user, ap.floorId))) {
      logger.warn({ uid: req.user?.uid, floorId: String(ap.floorId) }, 'Create device forbidden: cannot manage floor');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const created = await prisma.clients.create({ data: { mac, apId: toBi(apId) } });
    logger.info({ uid: req.user?.uid, id: String(created.id), apId }, 'Device created');
    res.json({ id: created.id.toString(), mac: created.mac });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'POST /api/admin/devices failed');
    res.status(500).json({ error: 'Failed to create device' });
  }
});

router.put('/api/admin/devices/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Update device unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const id = req.params.id;
    const toBiLocal = (v) => {
      const s = String(v);
      if (!/^\d+$/.test(s)) throw new Error(`Invalid ID: ${s}`);
      return BigInt(s);
    };

    const existing = await prisma.clients.findUnique({
      where: { id: toBiLocal(id) },
      include: { ap: { select: { id: true, floorId: true } } },
    });
    if (!existing) {
      logger.warn({ uid: req.user?.uid, id }, 'Update device not found');
      return res.status(404).json({ error: 'Device not found' });
    }

    if (!(await canManageFloor(user, existing.ap.floorId))) {
      logger.warn({ uid: req.user?.uid, floorId: String(existing.ap.floorId) }, 'Update device forbidden: cannot manage floor');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { mac, apId } = req.body;
    const data = {};

    if (mac != null) data.mac = mac;

    if (apId != null) {
      const targetAp = await prisma.aPs.findUnique({
        where: { id: toBiLocal(apId) },
        select: { id: true, floorId: true },
      });
      if (!targetAp) {
        logger.warn({ uid: req.user?.uid, apId }, 'Update device: target AP not found');
        return res.status(404).json({ error: 'AP not found' });
      }

      if (!(await canManageFloor(user, targetAp.floorId))) {
        logger.warn({ uid: req.user?.uid, floorId: String(targetAp.floorId) }, 'Update device forbidden: cannot manage target floor');
        return res.status(403).json({ error: 'Forbidden for target floor' });
      }

      data.apId = toBiLocal(apId);
    }

    if (Object.keys(data).length === 0) {
      logger.warn({ uid: req.user?.uid, id }, 'Update device: no valid fields');
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.clients.update({
      where: { id: toBiLocal(id) },
      data,
      include: { ap: { select: { floorId: true } } },
    });

    logger.info({ uid: req.user?.uid, id }, 'Device updated');
    res.json({
      id: updated.id.toString(),
      mac: updated.mac,
      apId: updated.apId.toString(),
      floorId: updated.ap?.floorId?.toString?.() ?? undefined,
    });
  } catch (e) {
    const msg = /Unique|unique/i.test(e.message) ? 'MAC already exists' : 'Failed to update device';
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'PUT /api/admin/devices/:id failed');
    res.status(400).json({ error: msg });
  }
});

router.delete('/api/admin/devices/:id', verifyToken, async (req, res) => {
  try {
    const user = await getAppUser(req);
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Delete device unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const id = req.params.id;
    const device = await prisma.clients.findUnique({
      where: { id: toBi(id) },
      include: { ap: { select: { floorId: true } } },
    });
    if (!device) {
      logger.warn({ uid: req.user?.uid, id }, 'Delete device not found');
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!(await canManageFloor(user, device.ap.floorId)) && user.role?.name !== 'Owner') {
      logger.warn({ uid: req.user?.uid, floorId: String(device.ap.floorId) }, 'Delete device forbidden: not scoped');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.clients.delete({ where: { id: toBi(id) } });
    logger.warn({ uid: req.user?.uid, id }, 'Device deleted');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'DELETE /api/admin/devices/:id failed');
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Profile
router.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const u = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: { include: { group: true } } },
    });
    if (!u) {
      logger.warn({ uid: req.user?.uid }, 'Profile unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }
    logger.info({ uid: req.user?.uid }, 'Profile loaded');
    res.json({
      user: {
        id: u.id.toString(),
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role ? { id: u.role.id.toString(), name: u.role.name } : null,
        groups: u.userGroups?.map(g => ({ id: g.group.id.toString(), name: g.group.name })) ?? [],
      },
    });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/profile failed');
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.put('/api/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const u = await prisma.users.update({
      where: { firebaseUid: req.user.uid },
      data: { ...(firstName != null && { firstName }), ...(lastName != null && { lastName }) },
      select: { id: true, firstName: true, lastName: true },
    });
    logger.info({ uid: req.user?.uid }, 'Profile updated');
    res.json({ id: u.id.toString(), firstName: u.firstName, lastName: u.lastName });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'PUT /api/profile failed');
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/api/profile/devices', verifyToken, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({ where: { firebaseUid: req.user.uid }, select: { id: true } });
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'List owned devices unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const devs = await prisma.userDevices.findMany({
      where: { userId: user.id },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, mac: true },
    });

    logger.info({ uid: req.user?.uid, count: devs.length }, 'Owned devices listed');
    res.json(devs.map((d) => ({ id: d.id.toString(), name: d.name, mac: d.mac })));
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'GET /api/profile/devices failed');
    res.status(500).json({ error: 'Failed to load devices' });
  }
});

router.post('/api/profile/devices', verifyToken, async (req, res) => {
  try {
    const { name, mac } = req.body;
    if (!name || !mac) {
      logger.warn({ uid: req.user?.uid }, 'Create owned device: missing fields');
      return res.status(400).json({ error: 'name and mac required' });
    }

    const user = await prisma.users.findUnique({ where: { firebaseUid: req.user.uid }, select: { id: true } });
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Create owned device unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const created = await prisma.userDevices.create({
      data: { name, mac, userId: user.id },
      select: { id: true, name: true, mac: true },
    });

    logger.info({ uid: req.user?.uid, id: String(created.id) }, 'Owned device created');
    res.json({ id: created.id.toString(), name: created.name, mac: created.mac });
  } catch (e) {
    const msg = /Unique|unique/i.test(e.message) ? 'MAC already exists' : 'Failed to create device';
    logger.error({ err: e, uid: req.user?.uid }, 'POST /api/profile/devices failed');
    res.status(400).json({ error: msg });
  }
});

router.put('/api/profile/devices/:id', verifyToken, async (req, res) => {
  try {
    const id = toBi(req.params.id);
    const { name, mac } = req.body;

    const user = await prisma.users.findUnique({ where: { firebaseUid: req.user.uid }, select: { id: true } });
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Update owned device unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const dev = await prisma.userDevices.findUnique({ where: { id } });
    if (!dev) {
      logger.warn({ uid: req.user?.uid, id: req.params.id }, 'Update owned device not found');
      return res.status(404).json({ error: 'Device not found' });
    }
    if (dev.userId !== user.id) {
      logger.warn({ uid: req.user?.uid, id: req.params.id }, 'Update owned device forbidden: not owner');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const upd = await prisma.userDevices.update({
      where: { id },
      data: { ...(name != null && { name }), ...(mac != null && { mac }) },
      select: { id: true, name: true, mac: true },
    });

    logger.info({ uid: req.user?.uid, id: req.params.id }, 'Owned device updated');
    res.json({ id: upd.id.toString(), name: upd.name, mac: upd.mac });
  } catch (e) {
    const msg = /Unique|unique/i.test(e.message) ? 'MAC already exists' : 'Failed to update device';
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'PUT /api/profile/devices/:id failed');
    res.status(400).json({ error: msg });
  }
});

router.delete('/api/profile/devices/:id', verifyToken, async (req, res) => {
  try {
    const id = toBi(req.params.id);

    const user = await prisma.users.findUnique({ where: { firebaseUid: req.user.uid }, select: { id: true } });
    if (!user) {
      logger.warn({ uid: req.user?.uid }, 'Delete owned device unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const dev = await prisma.userDevices.findUnique({ where: { id } });
    if (!dev) {
      logger.warn({ uid: req.user?.uid, id: req.params.id }, 'Delete owned device not found');
      return res.status(404).json({ error: 'Device not found' });
    }
    if (dev.userId !== user.id) {
      logger.warn({ uid: req.user?.uid, id: req.params.id }, 'Delete owned device forbidden: not owner');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.userDevices.delete({ where: { id } });
    logger.warn({ uid: req.user?.uid, id: req.params.id }, 'Owned device deleted');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'DELETE /api/profile/devices/:id failed');
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Roles
router.get('/api/admin/roles', verifyToken, async (req, res) => {
  try {
    const roles = await prisma.roles.findMany({ orderBy: { id: 'asc' } });
    logger.info({ uid: req.user?.uid, count: roles.length }, 'Roles listed');
    res.json(roles.map((r) => ({ id: r.id.toString(), name: r.name })));
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'List roles failed');
    res.status(500).json({ error: 'Failed to list roles' });
  }
});

// Pending users
router.get('/api/admin/pending-users', verifyToken, async (req, res) => {
  try {
    const me = await prisma.users.findUnique({ where: { firebaseUid: req.user.uid }, include: { role: true } });
    if (!me || me.role?.name !== 'Owner') {
      logger.warn({ uid: req.user?.uid, role: me?.role?.name }, 'List pending users forbidden');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const pendingRole = await prisma.roles.findFirst({ where: { name: 'Pending User' } });
    if (!pendingRole) {
      logger.info({ uid: req.user?.uid }, 'Pending users: no role found, empty');
      return res.json([]);
    }

    const users = await prisma.users.findMany({
      where: { roleId: pendingRole.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, createdAt: true },
    });

    logger.info({ uid: req.user?.uid, count: users.length }, 'Pending users listed');
    res.json(users.map((u) => ({ id: u.id.toString(), email: u.email, createdAt: u.createdAt })));
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid }, 'List pending users failed');
    res.status(500).json({ error: 'Failed to list pending users' });
  }
});

router.post('/api/admin/pending-users/:id/assign', verifyToken, async (req, res) => {
  try {
    const userId = toBi(req.params.id);
    const { roleId, groupIds } = req.body || {};

    if (!roleId || !Array.isArray(groupIds) || groupIds.length === 0) {
      logger.warn({ uid: req.user?.uid }, 'Assign pending user: missing roleId/groupIds');
      return res.status(400).json({ error: 'roleId and groupIds[] are required' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      logger.warn({ uid: req.user?.uid, id: req.params.id }, 'Assign pending user: user not found');
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.users.update({ where: { id: userId }, data: { roleId: toBi(roleId) } });
    await prisma.$transaction([
      prisma.userGroups.deleteMany({ where: { userId } }),
      prisma.userGroups.createMany({ data: groupIds.map((gid) => ({ userId, groupId: toBi(gid) })), skipDuplicates: true }),
    ]);

    logger.info({ uid: req.user?.uid, id: req.params.id, roleId, groups: groupIds.map(String) }, 'Pending user assigned');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: req.user?.uid, id: req.params.id }, 'Assign pending user failed');
    res.status(400).json({ error: 'Failed to assign' });
  }
});

// Account deletion
router.delete('/api/profile', verifyToken, async (req, res) => {
  const firebaseUid = req.user?.uid;
  if (!firebaseUid) {
    logger.warn('Delete profile unauthorized: missing uid');
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.users.findUnique({ where: { firebaseUid }, select: { id: true, firebaseUid: true } });

    if (!user) {
      try { await admin.auth().deleteUser(firebaseUid); } catch {}
      logger.warn({ uid: firebaseUid }, 'Delete profile: user not found in DB, deleted Firebase account if existed');
      res.clearCookie('access_token');
      return res.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userGroups.deleteMany({ where: { userId: user.id } });
      await tx.userDevices.deleteMany({ where: { userId: user.id } });
      await tx.users.delete({ where: { id: user.id } });
    });

    await admin.auth().deleteUser(firebaseUid);

    logger.warn({ uid: firebaseUid }, 'Account deleted');
    res.clearCookie('access_token');
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e, uid: firebaseUid }, 'Delete profile failed');
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
