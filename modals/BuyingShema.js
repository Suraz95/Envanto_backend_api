const mongoose = require("mongoose")
const orderSchema = new mongoose.Schema({
    products: [{
      product: { type: productSchema, required: true },
      quantity: { type: Number, required: true },
      options:{type:String,required:true},
      price: { type: Number, required: true }
    }],
    address: { type: String, required: true },
    date: { type: String, required: true }
  });
  // Define the buying schema to include multiple orders
  const buyingSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    orders: [orderSchema]
  });
  
  // Export the model
  module.exports = mongoose.model("BuyingModule", buyingSchema);