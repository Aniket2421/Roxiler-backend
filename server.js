const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const Data = require("./Models/DataSchema");
const app = express();
require("dotenv").config();


const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT;

app.get("/datasettodb", async (req, res) => {
    try {
        const response = await fetch(
            "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
        );
        const datap = await response.json();
        await Data.insertMany(datap);
        return res.status(200).json({ message: "Database initialized with seed data" });
    } catch (error) {
        return res
            .status(500)
            .json({ error: "An error occurred during database initialization" });
    }
});

app.get("/salesbymonth/:month", async (req, res) => {
    try {
        const { month } = req.params;
        const salesData = await Data.find({
            $expr: {
                $eq: [
                    { $month: { date: "$dateOfSale", timezone: "+05:30" } },
                    parseInt(month, 10),
                ],
            },
        });
        return res.json(salesData);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get("/Gettransactions", async (req, res) => {
    try {
        const { page = 1, perPage = 10, search = '' } = req.query;

        const regex = new RegExp(search, 'i');

        const transactions = await Data.find({
            $or: [
                { title: regex },
                { description: regex },
                { price: regex },
            ],
        })
            .skip((page - 1) * perPage)
            .limit(perPage);

        res.json({ transactions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/Getstatistics', async (req, res) => {
    try {
        let { month = 3 } = req.query;
        let filter = dataOfSale = {
            $expr: {
                $eq: [
                    { $month: "$dateOfSale" },
                    parseInt(month, 10)
                ]
            }
        }

        const totalSaleAmount = await Data.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$price" }
                }
            }
        ]);
        const soldItemsCount = await Data.countDocuments({ ...filter, sold: true });
        const unsoldItemsCount = await Data.countDocuments({ ...filter, sold: false });
        return res.json({
            totalSaleAmount: (totalSaleAmount[0] && totalSaleAmount[0].totalAmount) || 0,
            soldItemsCount,
            unsoldItemsCount
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
})

app.get('/Getbarchart', async (req, res) => {
    try {
        const { month } = req.query;
        const matchQuery = {
            $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month, 10)] }
        };
        const priceRanges = [
            { min: 0, max: 100 },
            { min: 101, max: 200 },
            { min: 201, max: 300 },
            { min: 301, max: 400 },
            { min: 401, max: 500 },
            { min: 501, max: 600 },
            { min: 601, max: 700 },
            { min: 701, max: 800 },
            { min: 801, max: 900 },
        ]
        const aggregationpipeline = [];
        aggregationpipeline.push({ $match: matchQuery });
        aggregationpipeline.push({
            $group: {
                _id: {
                    $switch: {
                        branches: priceRanges.map((range, index) => ({
                            case: {
                                $and: [{ $gte: ["$price", range.min] }, { $lt: ["$price", range.max] }]
                            },
                            then: index
                        })),
                        default: priceRanges.length
                    }
                },
                count: { $sum: 1 }
            }
        });

        const result = await Data.aggregate(aggregationpipeline);
        const formattedResult = result.map(e => ({
            priceRange: e._id === priceRanges.length ? 'Above ' + priceRanges[priceRanges.length - 1].max : `$${priceRanges[e._id].min} - $${priceRanges[e._id].max}`,
            itemCount: e.count
        }));
        return res.json(formattedResult);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
})

app.get('/Getpiechart', async (req, res) => {
    try {
        const { month } = req.query;
        const matchQuery = {
            $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month, 10)] }
        };
        const aggregationPipeline = [];
        aggregationPipeline.push({ $match: matchQuery });
        aggregationPipeline.push({
            $group: {
                _id: "$category",
                itemCount: { $sum: 1 }
            }
        });
        const result = await Data.aggregate(aggregationPipeline);
        const formattedResult = result.map(({ _id, itemCount }) => ({
            [`${_id} category`]: itemCount
        }));
        return res.json(formattedResult);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get("/Getcombineddata", async (req, res) => {
    const { search, page = 1, perPage = 10, month } = req.query;
    try {
        const [transactions, statistics, piechart, barchart] = await Promise.all([
            axios.get(`https://roxiler-backend-4ghg.onrender.com/Gettransactions?month=${month}&search=${search}`),
            axios.get(`https://roxiler-backend-4ghg.onrender.com/Getstatistics?month=${month}`),
            axios.get(`https://roxiler-backend-4ghg.onrender.com/Getpiechart?month=${month}`),
            axios.get(`https://roxiler-backend-4ghg.onrender.com/Getbarchart?month=${month}`)
        ]);
        const transactionsData = transactions.data;
        const statisticsData = statistics.data;
        const pieChartData = piechart.data;
        const barchartData = barchart.data;


        // Combine the responses into a single object
        const combinedData = {
            transactions: transactionsData,
            statistics: statisticsData,
            pieChart: pieChartData,
            barChart: barchartData
        };

        return res.json(combinedData);
    } catch (error) {
        return res.json({ error: error.message });
    }
})

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB is connected!"))
    .catch((err) => console.log(err));

app.listen(PORT, () => {
    console.log("Server is running at:", PORT);
});
