const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({
  products: [
    {
      prod_name: { type: String, required: true },
      quantity: { type: Number, required: true },
      options_id: { type: String, required: true },
      price: { type: Number, required: true },
    },
  ],
  address: { type: String, required: true },
  date: { type: String },
});
const buyingSchema = new mongoose.Schema({
  email: { type: String, required: true},
  username: { type: String, required: true },
  orders: [orderSchema],
});
module.exports = mongoose.model("BuyingModule", buyingSchema);
