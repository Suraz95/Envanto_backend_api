const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { Products } = require("./modals/Products");
const Contact = require("./modals/ContactUs");
const { User } = require("./modals/User");
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
  path: "./.env",
});
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhoneNumber = (phone) => /^[7-9]\d{9}$/.test(phone);
const formatDate = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return "Invalid Date";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const formattedHours = String(hours).padStart(2, "0");

  return `${day}/${month}/${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;
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
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// User Registration
app.post(
  "/register",
  [
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
      const userExists = await User.findOne({ email, phone, name });
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
app.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user)
        return res.status(400).json({ message: "Invalid email or password" });

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid)
        return res.status(400).json({ message: "Invalid email or password" });

      const loginTimestamp = formatDate(new Date());
      user.timestamps.push({ login: loginTimestamp });
      await user.save();

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          username: user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

//  Logout Route
app.post("/logout", verifyToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.user;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email" });

    const lastLoginIndex = user.timestamps.length - 1;
    if (lastLoginIndex >= 0 && !user.timestamps[lastLoginIndex].logout) {
      user.timestamps[lastLoginIndex].logout = formatDate(new Date());
      await user.save();
    }

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add Products
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
// Products
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
//  message
app.post(
  "/send-message",
  [
    body("phone")
      .custom((value) => validatePhoneNumber(value))
      .withMessage("Phone number should be in Indian format"),
    body("email")
      .custom((value) => validateEmail(value))
      .withMessage("Invalid email format"),
  ],
  async (req, res) => {
    const { name, email, phone, message } = req.body;

    try {
      const newContact = new Contact({
        name,
        phone,
        email,
        message,
      });

      await newContact.save();
      res
        .status(200)
        .json({ success: true, message: "Message sent successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);
//  get messages
app.get("/messages", async (req, res) => {
  try {
    const messages = await Contact.find({});

    if (!messages) {
      return res.status(404).json({ message: "No categories found" });
    }

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
//  Add to wishlist
app.put("/wishlist", verifyToken, async (req, res) => {
  const { prod_name } = req.body;
  try {
    const { email } = req.user; // User information from JWT
    // Find the user based on the email
    const customer = await User.findOne({ email }); // Assuming you have a Customer model
    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }
    // Add the book to the wishlist if it's not already there
    if (!customer.wishlist.includes(prod_name)) {
      customer.wishlist.push(prod_name);
      await customer.save();
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error adding book to wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Get wishlist
app.get("/wishlist", verifyToken, async (req, res) => {
  try {
    const { email } = req.user; // User information from JWT
    // Find the user based on the email
    const customer = await User.findOne({ email });

    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ wishlist: customer.wishlist });
  } catch (error) {
    console.error("Error retrieving wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//  delete from wishlist
app.delete("/wishlist", verifyToken, async (req, res) => {
  const { prod_name } = req.body; // Extract book title from request body
  try {
    const { email } = req.user; // User information from JWT
    // Find the user based on the email
    const customer = await User.findOne({ email }); // Assuming you have a Customer model
    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }
    // Remove the book from the wishlist if it exists
    const index = customer.wishlist.indexOf(prod_name);
    if (index > -1) {
      customer.wishlist.splice(index, 1);
      await customer.save();
    }
    res.status(200).json(customer);
  } catch (error) {
    console.error("Error removing book from wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ADD to Cart
app.put("/add-to-cart", verifyToken, async (req, res) => {
  const { prod_name, options_id } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await User.findOne({ email });
    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the product is already in the cart
    const productInCart = customer.cart.find(
      item => item.prod_name === prod_name && item.options_id === options_id
    );

    // If the product is not in the cart, add it
    if (!productInCart) {
      customer.cart.push({ prod_name, options_id });
      await customer.save();
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Cart
app.get("/cart", verifyToken, async (req, res) => {
  try {
    const { email } = req.user; // User information from JWT
    // Find the user based on the email
    const customer = await User.findOne({ email });

    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ cart: customer.cart});
  } catch (error) {
    console.error("Error retrieving wishlist:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//  Delete from Cart
app.delete("/delete-cart", verifyToken, async (req, res) => {
  const { prod_name } = req.body;

  try {
    const { email } = req.user; // User information from JWT

    // Find the user based on the email
    const customer = await User.findOne({ email });
    if (!customer) {
      return res.status(404).json({ error: "User not found" });
    }

    // Filter out the item(s) from the cart based on prod_name
    customer.cart = customer.cart.filter(item => item.prod_name !== prod_name);

    await customer.save();

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
