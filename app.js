const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { Client } = require("elasticsearch");
// const elasticUrl = "http://localhost:9200";
const elasticUrl = "http://host.docker.internal:9200";
//const elasticUrl = "http://elasticsearch:9200";
const pdf = require('pdf-poppler');
const multer = require('multer');
const ejs = require('ejs')
const esclient   = new Client({ node: elasticUrl });
const elasticsearch = require('elasticsearch');
const path = require("path")

const mime = require('mime-types');
const pdf2img = require("pdf-img-convert");

const directoryPath = path.join(__dirname, 'database');
const fileType = mime.lookup(directoryPath)
const directoryPathImage = path.join(__dirname, 'ayush'); 
const app = express();

const client = new elasticsearch.Client({
  //  host: 'http://localhost:9200'
   host: 'http://host.docker.internal:9200'
});

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.set('views', 'views');
app.set('view engine', 'ejs');
// Set up Multer for file upload
app.use(express.static('public'))

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'database/');
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.render('home');
})

app.get("/index", (req, res) => {
  res.render("index");
})
app.get('/search', async (req, res) => {
  const q = req.query.q;
  if (q) {
    try {
      const results = await client.search({
        index: 'data',
        type: 'text',
        body: {
          query: {
            match: {
              text: q
            }
          }
        }
      });
      res.json(results.hits.hits);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error searching for documents.');
    }
  } else {
    res.render('search', { q });
  }
});



let docs = [];
let intervalId;
let results;
app.post('/upload', upload.single('file'),  (req, res) => {
   setInterval(async () => {
  try {
    const filePath = path.join(__dirname, 'database', req.file.originalname);
    const fileType = mime.lookup(filePath);
    const directoryPathImage = path.join(__dirname, 'database');
    
    if (fileType === 'application/pdf') {
      const files = await fs.promises.readdir(directoryPath);

      for (const file of files) {
        if (path.extname(file) === '.pdf') {
          const pdfArray = await pdf2img.convert(path.join(directoryPath, file));

          for (let i = 0; i < pdfArray.length; i++) {
            const pngFile = `${path.basename(file, '.pdf')}_${i}.png`;
            const pngFilePath = path.join(directoryPathImage, pngFile);

            await fs.promises.writeFile(pngFilePath, pdfArray[i]);

            const response = await axios({
              method: 'put',
              url: 'http://localhost:9998/tika',
              data: fs.createReadStream(pngFilePath),
              headers: {
                'Content-Type': mime.lookup(pngFilePath),
                Accept: 'text/plain',
                'X-Tika-OCRLanguage': 'eng',
              },
            });

            await client.index({
              index: 'data',
              id: pngFile,
              type: 'text',
              body: {
                text: response.data,
              },
              refresh: 'true',
            });
          }
        }
      }
    } else {
      const response = await axios({
        method: 'put',
        url: 'http://localhost:9998/tika',
        data: fs.createReadStream(filePath),
        headers: {
          'Content-Type': fileType,
          Accept: 'text/plain',
          'X-Tika-OCRLanguage': 'eng',
        },
      });

      const result = await client.index({
        index: 'data',
        type: 'text',
        id: req.file.originalname,
        body: {
          text: response.data,
        },
        refresh: 'true',
      });

      console.log('Data indexed successfully:', result);
    }

    console.log("Upload Complete");
  } catch (error) {
    console.error('Error:', error);
    console.log('Unable to upload file');
  }
   }, 5000)
});


// clear the interval when the app is closed
app.on("close", () => {
  clearInterval(intervalId);
});
const PORT= 3004
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});





