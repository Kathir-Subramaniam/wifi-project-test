// controllers/firebase-auth-controller.js
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
} = require("../config/firebase");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const logger = require("../utils/logger");
const isProd = process.env.NODE_ENV === "production";
const auth = getAuth();

class FirebaseAuthController {
  async registerUser(req, res) {
    try {
      const { firstName, lastName, email, password } = req.body;
      if (!firstName || !lastName || !email || !password) {
        logger.warn({ email }, "Register: missing fields");
        return res.status(422).json({
          firstName: !firstName ? "First name is required" : undefined,
          lastName: !lastName ? "Last name is required" : undefined,
          email: !email ? "Email is required" : undefined,
          password: !password ? "Password is required" : undefined,
        });
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUid = userCredential.user.uid;

      try {
        await prisma.users.create({
          data: { firstName, lastName, email, firebaseUid, roleId: BigInt(5) },
        });
        logger.info({ uid: firebaseUid, email }, "User created in DB");
      } catch (dbError) {
        logger.error({ err: dbError, email }, "DB error during register");
        if (dbError.code === "P2002") {
          return res.status(409).json({ message: "User already exists" });
        }
        return res
          .status(500)
          .json({ message: "Error saving to the database!" });
      }

      await sendEmailVerification(userCredential.user);
      logger.info({ uid: firebaseUid, email }, "Verification email sent");
      return res
        .status(201)
        .json({
          message: "Verification email sent! User created successfully!",
        });
    } catch (error) {
      logger.error({ err: error, email: req.body?.email }, "Register error");
      return res.status(500).json({ error: "Registration failed" });
    }
  }

  loginUser(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      logger.warn({ email }, "Login: missing fields");
      return res
        .status(422)
        .json({ email: "Email is required", password: "Password is required" });
    }
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const idToken = userCredential._tokenResponse.idToken;
        if (idToken) {
          res.cookie("access_token", idToken, {
            httpOnly: true,
            sameSite: isProd?"none":"lax",
            secure: isProd,
            // maxAge: 60 * 60 * 1000
          });
          logger.info(
            { uid: userCredential.user.uid, email },
            "User logged in"
          );
          res
            .status(200)
            .json({ message: "User logged in successfully", userCredential });
        } else {
          logger.error({ email }, "Login: missing idToken");
          res.status(500).json({ error: "Internal Server Error" });
        }
      })
      .catch((error) => {
        logger.error({ err: error, email }, "Login error");
        const errorMessage =
          error.message || "An error occurred while logging in";
        res.status(500).json({ error: errorMessage });
      });
  }

  logoutUser(req, res) {
    signOut(auth)
      .then(() => {
        logger.info({ uid: req.user?.uid }, "User logged out");
        res.clearCookie("access_token");
        res.status(200).json({ message: "User logged out successfully" });
      })
      .catch((error) => {
        logger.error({ err: error, uid: req.user?.uid }, "Logout error");
        res.status(500).json({ error: "Internal Server Error" });
      });
  }

  resetPassword(req, res) {
    const { email } = req.body;
    if (!email) {
      logger.warn("ResetPassword: missing email");
      return res.status(422).json({ email: "Email is required" });
    }
    sendPasswordResetEmail(auth, email)
      .then(() => {
        logger.info({ email }, "Password reset email sent");
        res
          .status(200)
          .json({ message: "Password reset email sent successfully!" });
      })
      .catch((error) => {
        logger.error({ err: error, email }, "Reset password error");
        res.status(500).json({ error: "Internal Server Error" });
      });
  }
}

module.exports = new FirebaseAuthController();
