const shortid = require("shortid");
const urlModel = require("../model/urlModel");
const redis = require("redis");
var validUrl = require("valid-url");
require("dotenv").config();

const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_URL,
  { no_ready_check: true }
);
redisClient.auth(process.env.REDIS_KEY, function (err) {
  if (err) throw err;
});
//redis-19418.c212.ap-south-1-1.ec2.cloud.redislabs.com:19418
redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

let linkCheck =
  /^https?\:\/\/([a-zA-Z0-9]+\.)?[a-zA-Z0-9]+\.[a-zA-Z0-9]+\/?[\w\/\-\.\_\~\!\$\&\'\(\)\*\+\,\;\=\:\@\%]+?$/;

//-----------------------------------------------------------------------------------------------------------------------------

const createShortUrl = async function (req, res) {
  try {
    const longUrl = req.body.longUrl;
    if (Object.keys(req.body).length == 0)
      return res
        .status(400)
        .send({ status: false, message: "Field cannot be empty" });
    let urlData = await GET_ASYNC(longUrl);
    // console.log(urlData)
    if (urlData) {
      let obj = JSON.parse(urlData); //convert string data into json format because we need result in json format
      // console.log(obj.longUrl)

      return res.status(200).send({ status: true, data: obj });
    } else {
      const existingURL = await urlModel
        .findOne({ longUrl: longUrl })
        .select({ longUrl: 1, shortUrl: 1, urlCode: 1, _id: 0 });

      if (existingURL)
        return res.status(200).send({ status: true, data: existingURL });

      // if (!linkCheck.test(longUrl))
      if (!validUrl.isUri(longUrl))
        return res.status(400).send({
          status: false,
          message: "Invalid URL. Please enter valid URL",
        });

      if (!req.body.uniqueCode) {
        const urlCode = shortid.generate();

        // let port = server.serverDetails.runningPort

        const shortUrl = `http://localhost:3000/${urlCode}`;

        const data = { longUrl, shortUrl, urlCode };

        const saveData = await urlModel.create(data);

        const resData = {
          longUrl: saveData.longUrl,
          shortUrl: saveData.shortUrl,
          urlCode: saveData.urlCode,
        };

        await SET_ASYNC(longUrl, JSON.stringify(resData));

        // console.log(longUrl)

        return res.status(201).send({ status: true, data: resData });
      } else {
        const urlCode = req.body.uniqueCode;
        // console.log(urlCode);

        const existingCode = await urlModel.findOne({ urlCode: urlCode });

        // console.log(existingCode);

        if (existingCode)
          return res.status(400).send({
            status: false,
            message: "This code already exists. Please select different code",
          });

        // let port = server.serverDetails.runningPort

        const shortUrl = `http://localhost:3000/${urlCode}`;

        const data = { longUrl, shortUrl, urlCode };

        const saveData = await urlModel.create(data);

        const resData = {
          longUrl: saveData.longUrl,
          shortUrl: saveData.shortUrl,
          urlCode: saveData.urlCode,
        };

        await SET_ASYNC(longUrl, JSON.stringify(resData));

        // console.log(longUrl)

        return res.status(201).send({ status: true, data: resData });
      }
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: err.message });
  }
};

//----------------------------------------------------------------------------------------------------------------------

const getUrl = async function (req, res) {
  try {
    const urlCode = req.params.urlCode;
    // console.log(urlCode);
    let urlData = await GET_ASYNC(urlCode);
    // console.log(urlData);
    if (urlData) {
      let obj = JSON.parse(urlData); //convert string data into json format because we need result in json format
      // console.log(obj.longUrl);
      // return res.status(302).redirect(obj.longUrl);
      return res
        .status(302)
        .send({ status: true, message: "Success", yourUrl: obj.longUrl });
    } else {
      let getData = await urlModel
        .findOne({ urlCode: urlCode })
        .select({ longUrl: 1, _id: 0 });
      // console.log(getData);
      if (!getData)
        return res
          .status(404)
          .send({ status: false, message: "No data found with this urlCode" });
      await SET_ASYNC(urlCode, JSON.stringify(getData)); //set data as string in cache because cache stored only in string format

      // return res.status(302).send({ status: true, data: `Found. Redirecting to ${getData.longUrl}`})
      // return res.status(302).redirect(getData.longUrl);
      return res
        .status(302)
        .send({ status: true, message: "Success", yourUrl: getData.longUrl });
    }
  } catch (err) {
    return res.status(500).send({ status: false, error: err.message });
  }
};

module.exports = { createShortUrl, getUrl };
