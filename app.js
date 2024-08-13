const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csvtojson = require('csvtojson');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const json2csv = require('json2csv').parse;

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb+srv://ruthvik:ruthvik@cluster1.onhko9g.mongodb.net/monday');

// Define a schema with dynamic fields
const fileSchema = new mongoose.Schema({
    filename: String,
    filetype: String,
    data: [mongoose.Schema.Types.Mixed]
});
const FileModel = mongoose.model('File', fileSchema);

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper function to read Excel file
const readExcelFile = (filePath) => {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet);
};

// Endpoint to upload a file
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const filePath = path.join(__dirname, req.file.path);
        let jsonArray;

        if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
            jsonArray = await csvtojson().fromFile(filePath);
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || req.file.originalname.endsWith('.xlsx')) {
            jsonArray = readExcelFile(filePath);
        } else {
            return res.status(400).send('Unsupported file type');
        }

        const fileData = {
            filename: req.file.originalname,
            filetype: req.file.mimetype,
            data: jsonArray
        };

        await FileModel.create(fileData);
        fs.unlinkSync(filePath); // Remove the uploaded file

        res.status(200).send('File uploaded and data saved to database');
    } catch (error) {
        res.status(500).send('An error occurred: ' + error.message);
    }
});

// Endpoint to list all uploaded files
app.get('/files', async (req, res) => {
    try {
        const files = await FileModel.find({}, 'filename');
        res.json(files);
    } catch (error) {
        res.status(500).send('An error occurred: ' + error.message);
    }
});

// Endpoint to get details of a specific file
app.get('/files/:id', async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id);
        res.json(file);
    } catch (error) {
        res.status(500).send('An error occurred: ' + error.message);
    }
});

// Endpoint to update details of a specific file
app.put('/files/:id', async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id);
        if (!file) {
            return res.status(404).send('File not found');
        }

        file.data = req.body.data;
        await file.save();
        res.status(200).send('File data updated successfully');
    } catch (error) {
        res.status(500).send('An error occurred: ' + error.message);
    }
});

// Endpoint to download a file as CSV
app.get('/download/:id/csv', async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id);
        if (!file) {
            return res.status(404).send('File not found');
        }

        const csv = json2csv(file.data);
        res.header('Content-Type', 'text/csv');
        res.attachment(`${file.filename}.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).send('An error occurred: ' + error.message);
    }
});

// Endpoint to download a file as Excel
app.get('/download/:id/excel', async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id);
        if (!file) {
            return res.status(404).send('File not found');
        }

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(file.data);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        const filePath = path.join(__dirname, 'downloads', `${file.filename}.xlsx`);
        xlsx.writeFile(workbook, filePath);
        res.download(filePath, () => {
            fs.unlinkSync(filePath); // Remove the file after download
        });
    } catch (error) {
        res.status(500).send('An error occurred: ' + error.message);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});


app.delete('/files/:id', async (req, res) => {
  try {
      const file = await FileModel.findByIdAndDelete(req.params.id);
      if (!file) {
          return res.status(404).send('File not found');
      }
      res.status(200).send('File deleted successfully');
  } catch (error) {
      res.status(500).send('An error occurred: ' + error.message);
  }
});

app.patch('/files/:id/rename', async (req, res) => {
  try {
      const { newFilename } = req.body;
      const file = await FileModel.findById(req.params.id);
      if (!file) {
          return res.status(404).send('File not found');
      }

      file.filename = newFilename;
      await file.save();
      res.status(200).send('File renamed successfully');
  } catch (error) {
      res.status(500).send('An error occurred: ' + error.message);
  }
});

app.get('/',(req,res)=>{
  res.sendFile(__dirname+'/public/upload.html');
});