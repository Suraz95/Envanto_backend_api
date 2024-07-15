  const mongoose = require("mongoose");

  const optionsSchema = new mongoose.Schema({
    prod_quantity: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, required: true },
    total_stock: { type: Number, required: true },
    available_stock: { type: Number, required: true },
    sold_stock: { type: Number,default: 0}
  });

  const productSchema = new mongoose.Schema({
    prod_name: { type: String, required: true },
    brand: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    options: [optionsSchema]
  });

  const subCategorySchema = new mongoose.Schema({
    subCat_name: { type: String, required: true },
    products: [productSchema]
  });

  const categorySchema = new mongoose.Schema({
    cat_name: { type: String, required: true },
    subCategories: [subCategorySchema]
  });

  const Products = mongoose.model("Category", categorySchema);
  module.exports = { Products };
