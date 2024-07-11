const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv=require("dotenv")
const { Products } = require("./modals/Products");
const {User}=require("./modals/User")
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const app = express();
app.use(cors());
app.use(express.json());
app.listen(8000, () => {
  console.log(`⚙️  Port is connected on route ${process.env.PORT}`);
});
app.get("/", (req, res) => {
  res.send("ok");
});
dotenv.config({
  path: "./.env"
});
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhoneNumber = (phone) => /^[7-9]\d{9}$/.test(phone);
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};
mongoose
  .connect(process.env.db)
  .then(() => {
    console.log("connected to mongodb ");
  })
  .catch((err) => {
    console.log(err);
  });

// JWT Authorization
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
  } catch (error) {
      res.status(401).json({ message: 'Unauthorized' });
  }
};

// User Registration
app.post(
  "/register",[
    body("name")
      .isLength({ min: 3 })
      .withMessage("Name should be at least 3 letters long")
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage("Name should contain only letters"),
    body("username")
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage("Username should contain only letters and numbers"),
    body("phone")
      .custom((value) => validatePhoneNumber(value))
      .withMessage("Phone number should be in Indian format"),
    body("email")
      .custom((value) => validateEmail(value))
      .withMessage("Invalid email format"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password should be at least 8 characters long"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, username, phone, email, password, userType } = req.body;

    try {
      const userExists = await User.findOne({ email, phone , name });
      if (userExists)
        return res.status(400).json({ message: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        name,
        username,
        phone,
        email,
        password: hashedPassword,
        userType,
      });

      await newUser.save();

      res.status(200).json({ message: "User registered successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// User Login
app.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid email or password' });

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return res.status(400).json({ message: 'Invalid email or password' });

      const loginTimestamp = formatDate(new Date());
      user.timestamps.push({ login: loginTimestamp });
      await user.save();

      const token = jwt.sign({ userId: user._id, role: user.userType }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.status(200).json({ token});
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});

//  Logout Route
app.post('/logout', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

   const { email } = req.body;
  

  try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid email' });

      const lastLoginIndex = user.timestamps.length - 1;
      if (lastLoginIndex >= 0 && !user.timestamps[lastLoginIndex].logout) {
          user.timestamps[lastLoginIndex].logout = formatDate(new Date());
          await user.save();
      }


      res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});

// Add   Products
app.post("/api/Products", async (req, res) => {
  const { cat_name, subCategories } = req.body;

  try {
    let category = await Products.findOne({ cat_name });

    if (category) {
      // Category exists, check for subcategories
      let subCategoryExists = false;
      subCategories.forEach((subCat) => {
        const existingSubCat = category.subCategories.find(
          (sc) => sc.subCat_name === subCat.subCat_name
        );

        if (existingSubCat) {
          // Subcategory exists
          subCategoryExists = true;
          return res.status(200).json({
            message: "Subcategory already exists",
            subCategory: existingSubCat,
          });
        } else {
          // Add new subcategory
          category.subCategories.push(subCat);
        }
      });

      if (!subCategoryExists) {
        await category.save();
        return res.status(201).json(category);
      }
    } else {
      // Create new category with subcategories
      category = new Products({
        cat_name,
        subCategories,
      });
      const savedCategory = await category.save();
      return res.status(201).json(savedCategory);
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});
app.get("/Products", async (req, res) => {
  try {
    const categories = await Products.find({}, "cat_name subCategories");

    if (!categories) {
      return res.status(404).json({ message: "No categories found" });
    }

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
