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

    // 'register' = normal student sign-up OTP
    // 'admin'    = admin login OTP (separate flow, separate whitelist)
    purpose: {
      type: String,
      enum: ['register', 'admin'],
      default: 'register',
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
// 4. FRIEND REQUEST SCHEMA
// ==========================================

const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

const FriendRequest = mongoose.model(
  'FriendRequest',
  friendRequestSchema
);

// ==========================================
// 5. MESSAGE SCHEMA
// ==========================================

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model('Message', messageSchema);

// ==========================================
// ADMIN WHITELIST
// ==========================================
//
// Only these 5 exact email addresses are allowed to ever
// authenticate as admin. Anyone else attempting admin login,
// even with a valid registered account, is rejected outright.
//
// ==========================================

const ADMIN_WHITELIST = [
  {
    name: 'Asmita Bhowmick',
    rollNo: '2561078',
    email: 'asmita.bhowmick.aiml29@heritageit.edu.in',
  },
  {
    name: 'Bhavya Jain',
    rollNo: '2561070',
    email: 'bhavya.jain.aiml29@heritageit.edu.in',
  },
  {
    name: 'Tamoghana Bose',
    rollNo: '2561073',
    email: 'tamoghana.bose.aiml29@heritageit.edu.in',
  },
  {
    name: 'Monish Mandal',
    rollNo: '2561071',
    email: 'monish.mandal.aiml29@heritageit.edu.in',
  },
  {
    name: 'Arshi Azmi',
    rollNo: '2561051',
    email: 'arshi.azmi.aiml29@heritageit.edu.in',
  },
];

function isAdminWhitelisted(email) {
  const normalized = (email || '').trim().toLowerCase();

  return ADMIN_WHITELIST.some(
    (entry) => entry.email.toLowerCase() === normalized
  );
}

// ==========================================
// EMAIL TRANSPORTER
// ==========================================

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL — more reliable than STARTTLS (587) on flaky cloud networks

  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },

  // Generous timeouts so a slow/cold Render network doesn't
  // give up before Gmail even responds
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,

  // Reuse connections instead of opening a fresh one every time
  pool: true,
  maxConnections: 3,
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

    await sendMailWithRetry(mailOptions);
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
// SEND MAIL WITH ONE AUTOMATIC RETRY
// ==========================================
//
// Render's free tier occasionally has a flaky/slow outbound
// connection to Gmail's SMTP servers, causing an intermittent
// ETIMEDOUT on the first attempt. Retrying once, a couple of
// seconds later, resolves the vast majority of these cases
// without the person having to click "Send OTP" again.
// ==========================================

async function sendMailWithRetry(mailOptions, attempt = 1) {
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    if (attempt >= 2) {
      throw error;
    }

    console.warn(
      `Email send attempt ${attempt} failed (${error.message}). Retrying...`
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    return sendMailWithRetry(mailOptions, attempt + 1);
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
// STUDENT DIRECTORY ROUTES
// ==========================================

// GET all verified students except the requesting user,
// annotated with the friend/request status between them.
app.get('/api/users/:currentUserId', async (req, res) => {
  try {
    const { currentUserId } = req.params;

    const users = await User.find({
      _id: { $ne: currentUserId },
      status: 'verified',
    }).select('-password');

    const requests = await FriendRequest.find({
      $or: [
        { from: currentUserId },
        { to: currentUserId },
      ],
    });

    const usersWithStatus = users.map((user) => {
      const relevant = requests.find(
        (r) =>
          (r.from.toString() === currentUserId &&
            r.to.toString() === user._id.toString()) ||
          (r.to.toString() === currentUserId &&
            r.from.toString() === user._id.toString())
      );

      let connectionStatus = 'none';

      if (relevant) {
        if (relevant.status === 'accepted') {
          connectionStatus = 'friends';
        } else if (relevant.status === 'pending') {
          connectionStatus =
            relevant.from.toString() === currentUserId
              ? 'pending_sent'
              : 'pending_received';
        }
      }

      return {
        ...user.toObject(),
        connectionStatus,
      };
    });

    res.status(200).json(usersWithStatus);
  } catch (error) {
    console.error('Fetch Users Error:', error);

    res.status(500).json({
      message: 'Failed to fetch student directory.',
      error: error.message,
    });
  }
});

// ==========================================
// FRIEND REQUEST ROUTES
// ==========================================

// SEND a friend request
app.post('/api/requests/send', async (req, res) => {
  try {
    const { fromId, toId } = req.body;

    if (!fromId || !toId) {
      return res.status(400).json({
        message: 'fromId and toId are required.',
      });
    }

    if (fromId === toId) {
      return res.status(400).json({
        message: 'You cannot send a request to yourself.',
      });
    }

    const existing = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId },
        { from: toId, to: fromId },
      ],
    });

    if (existing) {
      return res.status(400).json({
        message: 'A request already exists between these users.',
      });
    }

    const request = await FriendRequest.create({
      from: fromId,
      to: toId,
      status: 'pending',
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to send request.',
      error: error.message,
    });
  }
});

// CANCEL a pending, outgoing friend request
app.post('/api/requests/cancel', async (req, res) => {
  try {
    const { fromId, toId } = req.body;

    await FriendRequest.deleteOne({
      from: fromId,
      to: toId,
      status: 'pending',
    });

    res.status(200).json({
      message: 'Request cancelled.',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to cancel request.',
      error: error.message,
    });
  }
});

// GET all pending requests received by a user
app.get('/api/requests/incoming/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const requests = await FriendRequest.find({
      to: userId,
      status: 'pending',
    }).populate('from', '-password');

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch incoming requests.',
      error: error.message,
    });
  }
});

// ACCEPT or REJECT a friend request
app.post('/api/requests/respond', async (req, res) => {
  try {
    const { requestId, action } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        message: 'Invalid action.',
      });
    }

    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found.',
      });
    }

    if (action === 'accept') {
      request.status = 'accepted';
      await request.save();
    } else {
      await FriendRequest.deleteOne({ _id: requestId });
    }

    res.status(200).json({
      message:
        action === 'accept'
          ? 'Request accepted.'
          : 'Request rejected.',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to respond to request.',
      error: error.message,
    });
  }
});

// GET all accepted friends of a user (chat-eligible contacts)
app.get('/api/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const accepted = await FriendRequest.find({
      status: 'accepted',
      $or: [{ from: userId }, { to: userId }],
    })
      .populate('from', '-password')
      .populate('to', '-password');

    const friends = accepted.map((r) => {
      const friend =
        r.from._id.toString() === userId ? r.to : r.from;

      return friend;
    });

    res.status(200).json(friends);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch friends list.',
      error: error.message,
    });
  }
});

// ==========================================
// CHAT / MESSAGE ROUTES
// ==========================================

// GET the full conversation between two users
// (only allowed if they are accepted friends)
app.get(
  '/api/messages/:userId1/:userId2',
  async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;

      const areFriends = await FriendRequest.findOne({
        status: 'accepted',
        $or: [
          { from: userId1, to: userId2 },
          { from: userId2, to: userId1 },
        ],
      });

      if (!areFriends) {
        return res.status(403).json({
          message:
            'You can only chat with accepted connections.',
        });
      }

      const messages = await Message.find({
        $or: [
          { from: userId1, to: userId2 },
          { from: userId2, to: userId1 },
        ],
      }).sort({ createdAt: 1 });

      res.status(200).json(messages);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch messages.',
        error: error.message,
      });
    }
  }
);

// SEND a message (only allowed between accepted friends)
app.post('/api/messages/send', async (req, res) => {
  try {
    const { fromId, toId, text } = req.body;

    if (!fromId || !toId || !text || !text.trim()) {
      return res.status(400).json({
        message: 'fromId, toId and text are required.',
      });
    }

    const areFriends = await FriendRequest.findOne({
      status: 'accepted',
      $or: [
        { from: fromId, to: toId },
        { from: toId, to: fromId },
      ],
    });

    if (!areFriends) {
      return res.status(403).json({
        message:
          'You can only message accepted connections.',
      });
    }

    const message = await Message.create({
      from: fromId,
      to: toId,
      text: text.trim(),
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to send message.',
      error: error.message,
    });
  }
});

// ==========================================
// ADMIN AUTHENTICATION ROUTES
// ==========================================
//
// Two-step, whitelist-only admin login:
//   1) /api/admin/send-otp   -> checks email is one of the
//      5 whitelisted admins AND has a registered account,
//      then emails a one-time OTP.
//   2) /api/admin/verify     -> checks the OTP AND the
//      account password before granting admin access.
//
// The user's role in the database is NOT changed by this -
// they stay a normal 'student' record. Admin access is only
// granted for that login session on the frontend.
// ==========================================

app.post('/api/admin/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAdminWhitelisted(normalizedEmail)) {
      return res.status(403).json({
        message:
          'This email is not authorized for admin access.',
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (!existingUser) {
      return res.status(404).json({
        message:
          'No registered student account found for this email. Please register a normal account first.',
      });
    }

    const generatedOTP = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    await OTP.deleteMany({
      email: normalizedEmail,
      purpose: 'admin',
    });

    await OTP.create({
      email: normalizedEmail,
      otp: generatedOTP,
      purpose: 'admin',
    });

    await sendOTPEmail(normalizedEmail, generatedOTP);

    res.status(200).json({
      message:
        'Admin OTP has been dispatched to your Heritage email address.',
    });
  } catch (error) {
    console.error('Admin Send OTP Error:', error);

    res.status(500).json({
      message: 'Failed to generate admin OTP.',
      error: error.message,
    });
  }
});

app.post('/api/admin/verify', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        message: 'Email, OTP and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAdminWhitelisted(normalizedEmail)) {
      return res.status(403).json({
        message:
          'This email is not authorized for admin access.',
      });
    }

    const record = await OTP.findOne({
      email: normalizedEmail,
      otp: otp.trim(),
      purpose: 'admin',
    });

    if (!record) {
      return res.status(400).json({
        message: 'Invalid or expired OTP code.',
      });
    }

    await OTP.deleteMany({
      email: normalizedEmail,
      purpose: 'admin',
    });

    const user = await User.findOne({
      email: normalizedEmail,
      password,
    });

    if (!user) {
      return res.status(401).json({
        message: 'Incorrect password.',
      });
    }

    const userResponse = user.toObject();

    delete userResponse.password;

    // Grant admin role for this session only
    // (does not persist to the database)
    userResponse.role = 'admin';

    res.status(200).json({
      message: 'Admin login successful.',
      user: userResponse,
    });
  } catch (error) {
    console.error('Admin Verify Error:', error);

    res.status(500).json({
      message: 'Admin verification failed.',
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