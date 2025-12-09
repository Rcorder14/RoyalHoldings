/* -----------------------------
   Firebase Setup
------------------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyCCRKbIKfPGZ6s6qP9i2JsQ_mCdk_iSIho",
  authDomain: "royal-holding.firebaseapp.com",
  projectId: "royal-holding",
  storageBucket: "royal-holding.firebasestorage.app",
  messagingSenderId: "917277297176",
  appId: "1:917277297176:web:ab8df1eca1d82cec42516d",
  measurementId: "G-VN06QQZDH6"
};

let db, auth, isFirebaseConfigured = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseConfigured = true;
} catch (error) {
    console.error("Firebase not configured:", error);
    showAlert("Firebase not configured.", "error");
}

/* -----------------------------
   Global State
------------------------------ */
let currentUser = null;
let businesses = [];
let returns = [];
let branches = [];
let branchNumbers = [];

const COLLECTIONS = {
    BUSINESSES: "businesses",
    RETURNS: "returns",
    ADMIN: "admin",
    BRANCHES: "branches",
    BRANCH_NUMBERS: "branch_numbers"
};

/* -----------------------------
   App Initialization
------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});

async function initializeApp() {
    hideAll();
    const notice = document.getElementById("setupNotice");
    notice.innerHTML = "<div class='loading'>Loading system data...</div>";
    notice.style.display = "block";

    if (isFirebaseConfigured) {
        try {
            await loadData();
        } catch (err) {
            console.error("Init error:", err);
            showAlert("Error loading data. Check internet.", "error");
        }
    }

    notice.style.display = "none";

    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (currentUser.type === "admin") showAdminDashboard();
        else showBusinessDashboard();
    } else {
        showLogin();
    }
}

async function loadData() {
    try {
        const [bizSnap, retSnap, branchSnap, numSnap] = await Promise.all([
            db.collection(COLLECTIONS.BUSINESSES).get(),
            db.collection(COLLECTIONS.RETURNS).get(),
            db.collection(COLLECTIONS.BRANCHES).get(),
            db.collection(COLLECTIONS.BRANCH_NUMBERS).get()
        ]);

        businesses = bizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        returns = retSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        branches = branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        branchNumbers = numSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`Loaded: ${branches.length} branches, ${branchNumbers.length} numbers.`);
    } catch (e) {
        console.error("Error loading data from Firestore:", e);
    }
}

/* -----------------------------
   Authentication
------------------------------ */
function showLogin() {
    hideAll();
    document.getElementById("loginScreen").classList.remove("hidden");
}

function showRegister() {
    hideAll();
    document.getElementById("registerScreen").classList.remove("hidden");
}

function hideAll() {
    ["loginScreen", "registerScreen", "businessDashboard", "adminDashboard"]
        .forEach(id => document.getElementById(id).classList.add("hidden"));
}

async function handleLogin() {
    const userType = document.getElementById("userType").value;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) return showAlert("Enter email & password", "error");

    if (userType === "admin") {
        await handleAdminLogin(email, password);
    } else {
        await handleBusinessLogin(email, password);
    }
}

async function handleAdminLogin(email, password) {
    try {
        const snapshot = await db.collection(COLLECTIONS.ADMIN)
            .where("email", "==", email)
            .where("password", "==", password)
            .get();

        if (!snapshot.empty) {
            currentUser = { type: "admin", email };
            sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
            showAdminDashboard();
            return showAlert("Admin login successful", "success");
        }

        showAlert("Invalid admin credentials", "error");
    } catch (err) {
        console.error("Admin login error:", err);
        showAlert("Login failed", "error");
    }
}

async function handleBusinessLogin(email, password) {
    const business = businesses.find(b => b.email === email && b.password === password);
    if (!business) return showAlert("Invalid business credentials", "error");
    if (business.status === "suspended") return showAlert("Account suspended", "error");

    currentUser = { type: "business", ...business };
    sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
    showBusinessDashboard();
    showAlert(`Welcome back, ${business.businessName}`, "success");
}

async function handleRegister() {
    const businessName = document.getElementById("regBusinessName").value.trim();
    const contactName = document.getElementById("regContactName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!businessName || !contactName || !email || !phone || !password) {
        return showAlert("Fill all fields", "error");
    }

    if (businesses.find(b => b.email === email)) {
        return showAlert("Email already exists", "error");
    }

    const newBusiness = {
        businessName, contactName, email, phone, password,
        status: "active", registeredDate: new Date().toISOString()
    };

    try {
        const docRef = await db.collection(COLLECTIONS.BUSINESSES).add(newBusiness);
        newBusiness.id = docRef.id;
        businesses.push(newBusiness);

        showAlert("Registration successful!", "success");
        showLogin();
    } catch (err) {
        console.error("Error registering business:", err);
        showAlert("Registration failed", "error");
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem("currentUser");
    showLogin();
    showAlert("Logged out", "success");
}

/* -----------------------------
   Business Dashboard
------------------------------ */
function showBusinessDashboard() {
    hideAll();
    document.getElementById("businessDashboard").classList.remove("hidden");
    document.getElementById("businessName").textContent = currentUser.businessName;
    showBusinessTab("search");
}

function showBusinessTab(tab) {
    ["businessAddTab", "businessSearchTab", "businessBranchTab", "businessNumbersTab"]
        .forEach(id => document.getElementById(id).classList.add("hidden"));
    
    ["tabSearch", "tabAdd", "tabBranch", "tabNumbers"]
        .forEach(id => document.getElementById(id).classList.remove("active"));

    if (tab === "add") {
        document.getElementById("businessAddTab").classList.remove("hidden");
        document.getElementById("tabAdd").classList.add("active");
    } else if (tab === "search") {
        document.getElementById("businessSearchTab").classList.remove("hidden");
        document.getElementById("tabSearch").classList.add("active");
    } else if (tab === "branches") {
        document.getElementById("businessBranchTab").classList.remove("hidden");
        document.getElementById("tabBranch").classList.add("active");
    } else if (tab === "numbers") {
        document.getElementById("businessNumbersTab").classList.remove("hidden");
        document.getElementById("tabNumbers").classList.add("active");
    }
}

async function addReturn() {
    const customerName = document.getElementById("customerName").value.trim();
    const customerAddress = document.getElementById("customerAddress").value.trim();
    const phone1 = document.getElementById("phone1").value.trim();
    const phone2 = document.getElementById("phone2").value.trim();
    const whatsapp = document.getElementById("whatsapp").value.trim();
    const returnStatus = document.getElementById("returnStatus").value;
    const returnDetails = document.getElementById("returnDetails").value.trim();
    const itemDetails = document.getElementById("itemDetails").value.trim();

    if (!customerName || !phone1 || !returnStatus) {
        return showAlert("Customer Name, Phone 1 and Status are required.", "error");
    }
    
    const newReturn = {
        businessId: currentUser.id,
        businessName: currentUser.businessName,
        customerName, customerAddress, phone1, phone2: phone2 || null, whatsapp: whatsapp || null,
        returnStatus, statusRemark: returnDetails, returnDetails, itemDetails,
        dateAdded: new Date().toISOString()
    };

    try {
        const docRef = await db.collection(COLLECTIONS.RETURNS).add(newReturn);
        newReturn.id = docRef.id;
        returns.push(newReturn);

        document.querySelectorAll("#businessAddTab input, #businessAddTab textarea").forEach(el => el.value = "");
        document.getElementById("returnStatus").value = "";
        showAlert("Return record added successfully", "success");
    } catch (error) {
        console.error("Error adding return:", error);
        showAlert("Failed to add return. Try again.", "error");
    }
}

/* -----------------------------
   RENDER LOGIC
------------------------------ */
function universalSearchRecords() {
    const query = document.getElementById("universalSearch").value.trim().toLowerCase();
    const container = document.getElementById("searchResults");

    if (!query) {
        container.innerHTML = "<div class='loading'>Start typing to search records...</div>";
        return;
    }

    let results = returns.filter(r =>
        (r.customerName && r.customerName.toLowerCase().includes(query)) ||
        (r.customerAddress && r.customerAddress.toLowerCase().includes(query)) ||
        (r.phone1 && r.phone1.includes(query)) ||
        (r.phone2 && r.phone2.includes(query)) ||
        (r.whatsapp && r.whatsapp.includes(query)) ||
        ((r.statusRemark || r.returnDetails) && (r.statusRemark || r.returnDetails).toLowerCase().includes(query)) ||
        (r.itemDetails && r.itemDetails.toLowerCase().includes(query)) ||
        (r.businessName && r.businessName.toLowerCase().includes(query))
    );

    if (!results.length) {
        container.innerHTML = "<div class='loading'>No records found</div>";
    } else {
        container.innerHTML = results.map(r => {
            let cssClass = 'status-other';
            if (r.returnStatus === 'Cancelled') cssClass = 'status-cancelled';
            else if (r.returnStatus === 'Returned') cssClass = 'status-returned';

            const formattedDate = new Date(r.dateAdded).toLocaleDateString();

            return `
            <div class="result-card ${cssClass}">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-user-circle" style="color:#667eea"></i>
                        ${r.customerName}
                    </div>
                    <span class="badge ${cssClass}">${r.returnStatus}</span>
                </div>
                
                <div class="card-subtitle" style="margin-bottom:15px;">
                    Business: ${r.businessName}
                </div>

                <div class="card-grid">
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-phone"></i> Phone</span>
                        <div class="info-value">${r.phone1}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="far fa-calendar-alt"></i> Date</span>
                        <div class="info-value">${formattedDate}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-map-marker-alt"></i> Address</span>
                        <div class="info-value">${r.customerAddress || '-'}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-box"></i> Items</span>
                        <div class="info-value">${r.itemDetails || '-'}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><i class="fas fa-comment-dots"></i> Remark</span>
                        <div class="info-value">${r.statusRemark || r.returnDetails || '-'}</div>
                    </div>
                </div>
            </div>
            `;
        }).join("");
    }
}

/* -----------------------------
   Admin Dashboard
------------------------------ */
function showAdminDashboard() {
    hideAll();
    document.getElementById("adminDashboard").classList.remove("hidden");
    updateAdminStats();
    showAdminTab("businesses");
}

function updateAdminStats() {
    document.getElementById("totalBusinesses").textContent = businesses.length;
    document.getElementById("totalReturns").textContent = returns.length;
    document.getElementById("activeBusinesses").textContent = businesses.filter(b => b.status === "active").length;
}

function showAdminTab(tab) {
    ["adminBusinessesTab", "adminReturnsTab", "adminBranchesTab", "adminNumbersTab"]
        .forEach(id => document.getElementById(id).classList.add("hidden"));
    
    const tabs = document.querySelectorAll("#adminDashboard .tabs .tab");
    tabs.forEach(t => t.classList.remove("active"));

    if (tab === "businesses") {
        document.getElementById("adminBusinessesTab").classList.remove("hidden");
        tabs[0].classList.add("active");
        loadBusinessesList();
    } else if (tab === "returns") {
        document.getElementById("adminReturnsTab").classList.remove("hidden");
        tabs[1].classList.add("active");
        loadReturnsList();
    } else if (tab === "branches") {
        document.getElementById("adminBranchesTab").classList.remove("hidden");
        tabs[2].classList.add("active");
    } else if (tab === "numbers") {
        document.getElementById("adminNumbersTab").classList.remove("hidden");
        tabs[3].classList.add("active");
    }
}

/* -----------------------------
   Admin Functions
------------------------------ */
async function loadBusinessesList() {
    const container = document.getElementById("businessesList");
    container.innerHTML = "<div class='loading'>Loading businesses...</div>";

    try {
        const snapshot = await db.collection(COLLECTIONS.BUSINESSES).get();
        businesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!businesses.length) {
            container.innerHTML = "<div class='loading'>No businesses found</div>";
            return;
        }

        container.innerHTML = businesses.map(b => `
            <div class="result-card" style="border-left-color: #3b82f6;">
                <div class="card-header">
                    <div class="card-title">${b.businessName}</div>
                    <button class="btn btn-small btn-danger" onclick="deleteBusiness('${b.id}')">Delete</button>
                </div>
                <div class="card-grid">
                    <div class="info-item"><span class="info-label">Contact</span>${b.contactName}</div>
                    <div class="info-item"><span class="info-label">Phone</span>${b.phone}</div>
                    <div class="info-item"><span class="info-label">Email</span>${b.email}</div>
                </div>
            </div>
        `).join("");
    } catch (err) {
        container.innerHTML = "<div class='loading'>Failed to load businesses.</div>";
    }
}

async function deleteBusiness(id) {
    if (!confirm("Are you sure you want to delete this business?")) return;
    try {
        await db.collection(COLLECTIONS.BUSINESSES).doc(id).delete();
        businesses = businesses.filter(b => b.id !== id);
        showAlert("Business deleted successfully", "success");
        updateAdminStats();
        loadBusinessesList();
    } catch (err) {
        showAlert("Failed to delete business", "error");
    }
}

async function loadReturnsList() {
    const container = document.getElementById("allReturnsList");
    container.innerHTML = "<div class='loading'>Loading returns...</div>";

    try {
        const snapshot = await db.collection(COLLECTIONS.RETURNS).get();
        returns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!returns.length) {
            container.innerHTML = "<div class='loading'>No returns found</div>";
            return;
        }

        container.innerHTML = returns.map(r => {
             let cssClass = 'status-other';
             if (r.returnStatus === 'Cancelled') cssClass = 'status-cancelled';
             else if (r.returnStatus === 'Returned') cssClass = 'status-returned';

            return `
            <div class="result-card ${cssClass}">
                <div class="card-header">
                    <div class="card-title">${r.customerName}</div>
                    <span class="badge ${cssClass}">${r.returnStatus}</span>
                </div>
                <div class="card-grid">
                    <div class="info-item"><span class="info-label">Business</span>${r.businessName}</div>
                    <div class="info-item"><span class="info-label">Phone</span>${r.phone1}</div>
                </div>
                <div style="margin-top:15px; text-align:right;">
                    <button class="btn btn-small btn-danger" onclick="deleteReturn('${r.id}')">Delete Record</button>
                </div>
            </div>
            `;
        }).join("");
    } catch (err) {
        container.innerHTML = "<div class='loading'>Failed to load returns.</div>";
    }
}

async function deleteReturn(id) {
    if (!confirm("Delete this return?")) return;
    try {
        await db.collection(COLLECTIONS.RETURNS).doc(id).delete();
        returns = returns.filter(r => r.id !== id);
        showAlert("Return deleted successfully", "success");
        updateAdminStats();
        loadReturnsList();
    } catch (err) {
        showAlert("Failed to delete return", "error");
    }
}

/* -----------------------------
   Branches & Numbers
------------------------------ */

// Helper to Upload large data in chunks
async function uploadInChunks(collectionName, data, mapFn) {
    const BATCH_SIZE = 400; // Safe limit
    const total = data.length;
    let processed = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = data.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        chunk.forEach(item => {
            const docRef = db.collection(collectionName).doc();
            batch.set(docRef, mapFn ? mapFn(item) : item);
        });

        await batch.commit();
        processed += chunk.length;
        console.log(`Uploaded ${processed}/${total} items to ${collectionName}`);
    }
}

// 1. Admin Upload Branches
async function handleBranchUpload() {
    const fileInput = document.getElementById("branchJsonFile");
    const file = fileInput.files[0];
    if (!file) return showAlert("Please select a JSON file first.", "error");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const jsonData = JSON.parse(e.target.result);
            if (!Array.isArray(jsonData) || jsonData.length === 0) return showAlert("Invalid JSON file.", "error");
            
            if (!confirm(`Found ${jsonData.length} records. Upload now?`)) return;

            document.getElementById("uploadBtn").textContent = "Uploading...";
            document.getElementById("uploadBtn").disabled = true;

            const mapBranchData = (row) => ({
                city: row.CITY || row.City || row.city || "",
                district: row.DISTRICT || row.District || row.district || "",
                branch: row.BRANCH || row.Branch || row.branch || ""
            });

            await uploadInChunks(COLLECTIONS.BRANCHES, jsonData, mapBranchData);
            
            const snap = await db.collection(COLLECTIONS.BRANCHES).get();
            branches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            showAlert(`Success! ${jsonData.length} branches uploaded.`, "success");
            fileInput.value = "";
        } catch (error) {
            console.error(error);
            showAlert("Error uploading file. Check console.", "error");
        } finally {
            document.getElementById("uploadBtn").textContent = "Upload JSON Data";
            document.getElementById("uploadBtn").disabled = false;
        }
    };
    reader.readAsText(file);
}

// 2. Business Search Branches (Table View + Smart Sort)
function searchBranches() {
    const query = document.getElementById("branchSearchInput").value.trim().toLowerCase();
    const container = document.getElementById("branchSearchResults");

    if (!query) {
        container.innerHTML = "<div class='loading'>Type a city name...</div>";
        return;
    }

    // 1. Filter results
    let results = branches.filter(b => 
        (b.city && b.city.toLowerCase().includes(query)) ||
        (b.branch && b.branch.toLowerCase().includes(query))
    );

    // 2. Sort results: "Starts With" first, then A-Z
    results.sort((a, b) => {
        const aCity = a.city.toLowerCase();
        const bCity = b.city.toLowerCase();
        const aStarts = aCity.startsWith(query);
        const bStarts = bCity.startsWith(query);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aCity.localeCompare(bCity);
    });

    if (results.length === 0) {
        container.innerHTML = "<div class='loading'>No branches found.</div>";
    } else {
        // Generate Table HTML matching the image
        let tableHtml = `
            <table class="branch-table">
                <thead>
                    <tr>
                        <th>City <i class="fas fa-chevron-up" style="font-size:12px; margin-left:5px; color:#2563eb;"></i></th>
                        <th>District</th>
                        <th>Branch</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tableHtml += results.map(r => `
            <tr>
                <td class="highlight">${r.city}</td>
                <td>${r.district}</td>
                <td>${r.branch}</td>
            </tr>
        `).join("");

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    }
}

// 3. Admin Upload Numbers
async function handleNumbersUpload() {
    const fileInput = document.getElementById("numberJsonFile");
    const file = fileInput.files[0];
    if (!file) return showAlert("Please select a JSON file first.", "error");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const jsonData = JSON.parse(e.target.result);
            if (!Array.isArray(jsonData) || jsonData.length === 0) return showAlert("Invalid JSON file.", "error");
            
            if (!confirm(`Found ${jsonData.length} numbers. Upload now?`)) return;

            document.getElementById("uploadNumBtn").textContent = "Uploading...";
            document.getElementById("uploadNumBtn").disabled = true;

            await uploadInChunks(COLLECTIONS.BRANCH_NUMBERS, jsonData, null);

            const snap = await db.collection(COLLECTIONS.BRANCH_NUMBERS).get();
            branchNumbers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            showAlert(`Success! ${jsonData.length} numbers uploaded.`, "success");
            fileInput.value = "";
        } catch (error) {
            console.error(error);
            showAlert("Error uploading file.", "error");
        } finally {
            document.getElementById("uploadNumBtn").textContent = "Upload Numbers Data";
            document.getElementById("uploadNumBtn").disabled = false;
        }
    };
    reader.readAsText(file);
}

// 4. Business Search Numbers
function searchBranchNumbers() {
    const query = document.getElementById("numberSearchInput").value.trim().toLowerCase();
    const container = document.getElementById("numberSearchResults");

    if (!query) {
        container.innerHTML = "<div class='loading'>Type a branch name...</div>";
        return;
    }

    const results = branchNumbers.filter(item => 
        Object.values(item).some(val => String(val).toLowerCase().includes(query))
    );

    if (results.length === 0) {
        container.innerHTML = "<div class='loading'>No numbers found.</div>";
    } else {
        container.innerHTML = results.map(r => {
            // Flexible matching for different JSON key names
            const bName = r.branch || r.Branch || r.name || r.Name || "Branch";
            const bNum = r.number || r.Number || r.phone || r.Phone || "No Number";
            
            return `
            <div class="result-card" style="border-left-color: #7c3aed;">
                <div class="card-header">
                    <div class="card-title">
                        <i class="fas fa-building" style="color:#7c3aed"></i>
                        ${bName}
                    </div>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-phone-alt"></i> Contact Number</span>
                    <div class="info-value" style="font-size:1.1rem;">${bNum}</div>
                </div>
            </div>
            `;
        }).join("");
    }
}

/* -----------------------------
   Utility
------------------------------ */
function showAlert(msg, type) {
    const el = document.createElement("div");
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    document.getElementById("alertContainer").appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

/* -----------------------------------------------------------
   SECURITY / DETERRENTS
   (Added at the bottom to ensure core logic loads first)
----------------------------------------------------------- */

// Disable Right Click
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
});

// Disable Key Shortcuts (F12, Ctrl+Shift+I, etc.)
document.addEventListener('keydown', function(e) {
    // F12
    if(e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
    }
    // Ctrl+Shift+I (Inspect)
    if(e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
        e.preventDefault();
        return false;
    }
    // Ctrl+Shift+J (Console)
    if(e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
        e.preventDefault();
        return false;
    }
    // Ctrl+U (View Source)
    if(e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
        e.preventDefault();
        return false;
    }
});