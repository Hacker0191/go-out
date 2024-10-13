const express = require('express');
const app = express();
const path = require('path');
const admin = require('firebase-admin'); // Import Firebase Admin

// Firebase configuration
const serviceAccount = require('./firebase-key.json'); // Update the path to your service account file

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://go-out-50027-default-rtdb.firebaseio.com" // Your database URL
});

// Reference to the Firebase database
const dbRef = admin.database().ref('links');

// Store slugs and notes in memory for now (for testing)
const links = {}; // Define the links object to store in-memory data

const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: 'dfqyzvyuh', 
    api_key: '678328938827271', 
    api_secret: '8mxa_25Sp2OVB3Lq-ARm8Jg7VWs'
});

// Configure Multer to use Cloudinary for storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'personalized_files', // Folder in Cloudinary
        allowed_formats: ['jpg', 'png', 'pdf', 'docx'], // Allowed file types
    },
});

const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Route to display the form
app.get('/', (req, res) => {
    res.render('index', { personalizedLink: '', error: '', personalNote: '' });
});

// Route to handle link generation
app.post('/create', upload.single('file'), (req, res) => {
    const { name, slug, note } = req.body;
    const fileUrl = req.file ? req.file.path : null;

    if (links[slug]) {
        return res.render('index', { personalizedLink: '', error: 'Slug already exists. Choose another.', personalNote: '' });
    }

    links[slug] = { name, note, fileUrl };
    const personalizedLink = `${req.protocol}://${req.get('host')}/link/${slug}`;

    // Store the data in Firebase
    const linkData = {
        name: name,
        note: note, // Store the personal note
        fileUrl: fileUrl, // Store the file URL
    };

    dbRef.child(slug).set(linkData) // Store data under the slug as the key
        .then(() => {
            console.log("Link stored successfully in Firebase");
            res.render('index', { personalizedLink, error: '', personalNote: '' });
        })
        .catch((error) => {
            console.error("Error storing link in Firebase:", error);
            res.render('index', { personalizedLink: '', error: 'Error saving link.', personalNote: '' });
        });
});

// Route to display personalized link page
app.get('/link/:slug', (req, res) => {
    const slug = req.params.slug;

    // Check if the slug exists in the links object
    if (links[slug]) {
        const { name, note, fileUrl } = links[slug]; // Ensure fileUrl is retrieved here
        res.render('personal', { name, note, fileUrl }); // Pass fileUrl to the template
    } else {
        // Check Firebase for the link
        dbRef.child(slug).once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    const { name, note, fileUrl } = snapshot.val(); // Retrieve name, note, and fileUrl
                    res.render('personal', { name, note, fileUrl }); // Pass all values to the template
                } else {
                    res.status(404).send('Link not found');
                }
            })
            .catch((error) => {
                console.error("Error retrieving link from Firebase:", error);
                res.status(500).send('Error retrieving link');
            });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
