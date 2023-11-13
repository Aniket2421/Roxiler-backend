const mongoose = require('mongoose');

const Data = new mongoose.Schema({
    "id": Number,
    "title": String,
    "price": String,
    "description": String,
    "category": String,
    "image": String,
    "sold": Boolean,
    "dateOfSale": Date
})

const data = new mongoose.model("Datas", Data);
module.exports = data;