require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// MONGODB CONNECTION
// ==========================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
  });

// ==========================================
// SCHEMAS & MODELS
// ==========================================

// 1. Marketplace Item Schema
const marketItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    condition: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    sellerName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const MarketItem = mongoose.model('MarketItem', marketItemSchema);

// ==========================================
// 2. USER SCHEMA
// ==========================================

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    rollNo: {
      type: String,
      required: true,
      unique: true,
    },

    branch: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      default: 'verified',
    },

    role: {
      type: String,
      default: 'student',
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

// ==========================================
// 3. OTP SCHEMA
// ==========================================

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },

    otp: {
      type: String,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // OTP automatically expires after 10 minutes
    },
  }
);

const OTP = mongoose.model('OTP', otpSchema);

// ==========================================
// EMAIL TRANSPORTER
// ==========================================

const transporter = nodemailer.createTransport({
  service: 'gmail',

  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

// ==========================================
// SEND OTP EMAIL
// ==========================================

async function sendOTPEmail(targetEmail, otpCode) {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const mailOptions = {
      from: `"CampusConnect Heritage" <${process.env.EMAIL_USER}>`,

      to: targetEmail,

      subject: 'Your CampusConnect Verification Code',

      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          "
        >

          <h2 style="color: #4f46e5;">
            CampusConnect Verification
          </h2>

          <p>
            Use the OTP code below to verify your Heritage Institute
            student account:
          </p>

          <div
            style="
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 4px;
              color: #4f46e5;
              margin: 20px 0;
            "
          >
            ${otpCode}
          </div>

          <p
            style="
              color: #666;
              font-size: 12px;
            "
          >
            This OTP is valid for 10 minutes.
            Do not share this code with anyone.
          </p>

        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } else {
    // Local development fallback
    console.log('\n========================================');
    console.log(
      `[LOCAL DEV OTP] Email: ${targetEmail} | OTP: ${otpCode}`
    );
    console.log('========================================\n');
  }
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// ==========================================
// STEP 1: SEND OTP
// ==========================================

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, rollNo } = req.body;

    // ------------------------------------------
    // BASIC VALIDATION
    // ------------------------------------------

    if (!email || !rollNo) {
      return res.status(400).json({
        message: 'Email and Roll Number are required.',
        verified: false,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRollNo = rollNo.trim();

    // ------------------------------------------
    // SECURITY CHECK 1:
    // HERITAGE EMAIL DOMAIN
    // ------------------------------------------

    if (!normalizedEmail.endsWith('@heritageit.edu.in')) {
      return res.status(403).json({
        message:
          'Not verified: Only @heritageit.edu.in student email addresses are allowed.',
        verified: false,
      });
    }

    // ------------------------------------------
    // SECURITY CHECK 2:
    // EMAIL YEAR VALIDATION
    // ------------------------------------------
    //
    // Expected email format:
    //
    // 26xxxxxx@heritageit.edu.in
    // 27xxxxxx@heritageit.edu.in
    //
    // First two digits represent the year.
    //
    // 26 or greater = eligible
    // 25 or lower   = NOT VERIFIED
    //
    // ------------------------------------------

    const emailLocalPart = normalizedEmail.split('@')[0];

    // Make sure the email starts with at least two digits
    const yearMatch = emailLocalPart.match(/^(\d{2})/);

    if (!yearMatch) {
      return res.status(403).json({
        message:
          'Not verified: The email address does not contain a valid student admission year.',
        verified: false,
      });
    }

    const admissionYear = parseInt(yearMatch[1], 10);

    // ------------------------------------------
    // NEW VERIFICATION RULE
    // ------------------------------------------

    if (admissionYear < 26) {
      return res.status(403).json({
        message:
          'Not verified: Students with email year 25 or earlier are not eligible for registration.',
        verified: false,
        year: admissionYear,
      });
    }

    // ------------------------------------------
    // SECURITY CHECK 3:
    // ROLL NUMBER
    // ------------------------------------------

    const rollNoRegex = /^[0-9]{7,12}$/;

    if (!rollNoRegex.test(normalizedRollNo)) {
      return res.status(400).json({
        message:
          'Invalid Roll Number: Heritage roll numbers must consist only of numbers (7-12 digits).',
        verified: false,
      });
    }

    // ------------------------------------------
    // SECURITY CHECK 4:
    // CHECK EXISTING USER
    // ------------------------------------------

    const existingUser = await User.findOne({
      $or: [
        {
          email: normalizedEmail,
        },
        {
          rollNo: normalizedRollNo,
        },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        message:
          'A student with this Email or Roll Number is already registered.',
        verified: false,
      });
    }

    // ------------------------------------------
    // GENERATE 6-DIGIT OTP
    // ------------------------------------------

    const generatedOTP = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // ------------------------------------------
    // DELETE OLD OTP
    // ------------------------------------------

    await OTP.deleteMany({
      email: normalizedEmail,
    });

    // ------------------------------------------
    // SAVE NEW OTP
    // ------------------------------------------

    await OTP.create({
      email: normalizedEmail,
      otp: generatedOTP,
    });

    // ------------------------------------------
    // SEND OTP
    // ------------------------------------------

    await sendOTPEmail(
      normalizedEmail,
      generatedOTP
    );

    // ------------------------------------------
    // SUCCESS RESPONSE
    // ------------------------------------------

    res.status(200).json({
      message:
        'Email verified successfully. OTP has been dispatched to your official Heritage email address.',
      verified: true,
      year: admissionYear,
    });
  } catch (error) {
    console.error('Send OTP Error:', error);

    res.status(500).json({
      message: 'Failed to generate verification OTP.',
      verified: false,
      error: error.message,
    });
  }
});

// ==========================================
// STEP 2: VERIFY OTP & COMPLETE REGISTRATION
// ==========================================

app.post('/api/auth/register-verify', async (req, res) => {
  try {
    const {
      name,
      email,
      rollNo,
      branch,
      password,
      otp,
    } = req.body;

    // ------------------------------------------
    // BASIC VALIDATION
    // ------------------------------------------

    if (
      !name ||
      !email ||
      !rollNo ||
      !branch ||
      !password ||
      !otp
    ) {
      return res.status(400).json({
        message: 'All registration fields are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRollNo = rollNo.trim();

    // ------------------------------------------
    // CHECK EMAIL DOMAIN AGAIN
    // ------------------------------------------

    if (!normalizedEmail.endsWith('@heritageit.edu.in')) {
      return res.status(403).json({
        message:
          'Not verified: Only @heritageit.edu.in student email addresses are allowed.',
      });
    }

    // ------------------------------------------
    // CHECK EMAIL YEAR AGAIN
    // ------------------------------------------

    const emailLocalPart = normalizedEmail.split('@')[0];

    const yearMatch = emailLocalPart.match(/^(\d{2})/);

    if (!yearMatch) {
      return res.status(403).json({
        message:
          'Not verified: The email address does not contain a valid student admission year.',
      });
    }

    const admissionYear = parseInt(
      yearMatch[1],
      10
    );

    if (admissionYear < 26) {
      return res.status(403).json({
        message:
          'Not verified: Students with email year 25 or earlier are not eligible for registration.',
      });
    }

    // ------------------------------------------
    // VERIFY OTP
    // ------------------------------------------

    const record = await OTP.findOne({
      email: normalizedEmail,
      otp: otp.trim(),
    });

    if (!record) {
      return res.status(400).json({
        message:
          'Invalid or expired OTP code. Please try again.',
      });
    }

    // ------------------------------------------
    // DELETE OTP AFTER SUCCESSFUL VERIFICATION
    // ------------------------------------------

    await OTP.deleteMany({
      email: normalizedEmail,
    });

    // ------------------------------------------
    // CHECK USER AGAIN
    // ------------------------------------------

    const existingUser = await User.findOne({
      $or: [
        {
          email: normalizedEmail,
        },
        {
          rollNo: normalizedRollNo,
        },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        message:
          'A student with this Email or Roll Number is already registered.',
      });
    }

    // ------------------------------------------
    // CREATE VERIFIED STUDENT
    // ------------------------------------------

    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      rollNo: normalizedRollNo,
      branch,
      password,
      status: 'verified',
      role: 'student',
    });

    await newUser.save();

    // ------------------------------------------
    // REMOVE PASSWORD FROM RESPONSE
    // ------------------------------------------

    const userResponse = newUser.toObject();

    delete userResponse.password;

    // ------------------------------------------
    // SUCCESS
    // ------------------------------------------

    res.status(201).json({
      message: 'Registration verified and successful!',
      user: userResponse,
    });
  } catch (error) {
    console.error('Registration Error:', error);

    res.status(400).json({
      message: 'Registration could not be completed.',
      error: error.message,
    });
  }
});

// ==========================================
// STEP 3: STUDENT LOGIN
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      password,
    });

    if (!user) {
      return res.status(401).json({
        message: 'Incorrect email or password.',
      });
    }

    // Do not send password to frontend
    const userResponse = user.toObject();

    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    console.error('Login Error:', error);

    res.status(500).json({
      message: 'Login request failed.',
      error: error.message,
    });
  }
});

// ==========================================
// MARKETPLACE ROUTES
// ==========================================

// GET MARKETPLACE ITEMS
app.get('/api/marketplace', async (req, res) => {
  try {
    const items = await MarketItem.find().sort({
      createdAt: -1,
    });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch items.',
      error: error.message,
    });
  }
});

// CREATE MARKETPLACE ITEM
app.post('/api/marketplace', async (req, res) => {
  try {
    const {
      title,
      price,
      category,
      condition,
      description,
      sellerName,
    } = req.body;

    const newItem = new MarketItem({
      title,
      price,
      category,
      condition,
      description,
      sellerName,
    });

    const savedItem = await newItem.save();

    res.status(201).json(savedItem);
  } catch (error) {
    res.status(400).json({
      message: 'Failed to create item.',
      error: error.message,
    });
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/', (req, res) => {
  res.json({
    message: 'CampusConnect backend is running.',
    status: 'OK',
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(
    `Server is running on http://localhost:${PORT}`
  );
});