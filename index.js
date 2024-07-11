const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Products } = require("./modals/Products");
const {User}=require("./modals/User")
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const app = express();
app.use(cors());
app.use(express.json());
app.listen("8000", () => {
  console.log("server is running on port 8000");
});
app.get("/", (req, res) => {
  res.send("ok");
});
const db =
  "mongodb+srv://shaiksuraz50:fqJTIurnRnDHHAeP@cluster0.yuml5wf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhoneNumber = (phone) => /^[7-9]\d{9}$/.test(phone);
mongoose
  .connect(db)
  .then(() => {
    console.log("connected to mongodb ");
  })
  .catch((err) => {
    console.log(err);
  });

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
