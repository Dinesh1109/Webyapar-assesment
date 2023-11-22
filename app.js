const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const multer = require("multer");
const sharp = require("sharp");
const dotenv = require("dotenv");

const app = express();
const port = 3000;
dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<password>",
  process.env.DATABASE_PASSWORD
);
console.log(DB);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
  })
  .then(() => {
    console.log("DB connection successful!");
  });

const imageSchema = new mongoose.Schema({
  userId: String,
  imageUrl: String,
});

const Image = mongoose.model("Image", imageSchema);

// Passport Configuration
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

const GoogleStrategy = require("passport-google-oauth20").Strategy;
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "326712236903-hnrdfqkb910k7cc6mheucnovrn7cfesp.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    (token, tokenSecret, profile, done) => {
      return done(null, profile);
    }
  )
);

app.set("view engine", "pug");

app.use(
  session({ secret: "Hello-there", resave: true, saveUninitialized: true })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));

// Multer Configuration for Image Upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes
app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/upload");
  }
);

app.get("/upload", ensureAuthenticated, (req, res) => {
  res.render("upload");
});

app.post(
  "/upload",
  ensureAuthenticated,
  upload.single("image"),
  async (req, res) => {
    try {
      const processedImage = await sharp(req.file.buffer)
        .resize({ width: 300, height: 400, fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      const newImage = new Image({
        userId: req.user.id,
        imageUrl: `data:image/webp;base64,${processedImage.toString("base64")}`,
      });

      await newImage.save();
      res.redirect("/gallery");
    } catch (err) {
      console.error("Error processing or saving image:", err);
      res.status(500).send("Error processing or saving image");
    }
  }
);

app.get("/gallery", ensureAuthenticated, async (req, res) => {
  try {
    const images = await Image.find({ userId: req.user.id });
    res.render("gallery", { images });
  } catch (err) {
    console.error("Error retrieving images:", err);
    res.status(500).send("Error retrieving images");
  }
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
