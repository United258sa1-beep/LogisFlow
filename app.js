// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDTWEA0bWYCIJbQ8vJ97JX3KKXaHjV-Bww",
    authDomain: "online-delivery-81c65.firebaseapp.com",
    projectId: "online-delivery-81c65",
    storageBucket: "online-delivery-81c65.firebasestorage.app",
    messagingSenderId: "882726609813",
    appId: "1:882726609813:web:5a83a8f5bcadca8bd9ec9c",
    measurementId: "G-8CMSJ658FM"
};

console.log("Initializing Firebase with project:", firebaseConfig.projectId);

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.firestore();
    console.log("Firebase Firestore initialized successfully.");
} catch (e) {
    console.error("Firebase initialization failed:", e.message);
    alert("Firebase initialization failed. Please check your config.");
}

// State Management
let orders = [];
let areas = [];
let currentViewMode = 'all'; // 'all', 'branch', 'area', or 'history'
let focusedBranchId = '';
let focusedAreaId = '';

// DOM Elements
const ordersList = document.getElementById('orders-list');
const addOrderBtn = document.getElementById('add-order-btn');
const branchFocusView = document.getElementById('branch-focus-view');
const deliverList = document.getElementById('deliver-list');
const collectList = document.getElementById('collect-list');
const branchSelect = document.getElementById('branch-select');
const areaSelect = document.getElementById('area-select');
const branchSelectorContainer = document.getElementById('branch-selector-container');
const areaSelectorContainer = document.getElementById('area-selector-container');
const areaManagerPanel = document.getElementById('area-manager');
const areaListContainer = document.getElementById('area-list');
const viewAllBtn = document.getElementById('view-all-btn');
const viewBranchBtn = document.getElementById('view-branch-btn');
const viewAreaBtn = document.getElementById('view-area-btn');
const viewHistoryBtn = document.getElementById('view-history-btn');
const printDriverBtn = document.getElementById('print-driver-btn');

const orderFormInputs = {
    orderNumber: document.getElementById('order-number'),
    drugName: document.getElementById('drug-name'),
    quantity: document.getElementById('quantity'),
    branchFrom: document.getElementById('branch-from'),
    branchTo: document.getElementById('branch-to')
};

// Start Real-time Listeners
initDataSync();

function initDataSync() {
    console.log("Starting real-time data sync...");
    
    // Listen for Orders
    db.collection('orders').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        console.log("Orders snapshot received. Count:", snapshot.size);
        orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrders();
        updateBranchDropdown();
        
        // Update Sync Status
        syncStatus.innerText = 'Connected: ' + new Date().toLocaleTimeString();
        syncStatus.style.color = '#10b981'; // Green
        
        // One-time migration from LocalStorage if needed
        checkMigration();
    }, err => {
        console.error("Firestore Orders error:", err.message);
        syncStatus.innerText = 'Sync Error: Check Console';
        syncStatus.style.color = '#ef4444'; // Red
        if (err.message.includes("permission")) {
            alert("CRITICAL: Database permissions denied. Please check your Firestore Rules (set to Test Mode).");
        }
    });

    // Listen for Areas
    db.collection('areas').onSnapshot(snapshot => {
        console.log("Areas snapshot received. Count:", snapshot.size);
        areas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAreas();
        updateAreaDropdown();
    }, err => {
        console.error("Firestore Areas error:", err.message);
    });
}

function checkMigration() {
    const localOrders = JSON.parse(localStorage.getItem('deliveryOrders'));
    const localAreas = JSON.parse(localStorage.getItem('deliveryAreas'));

    if (localOrders && localOrders.length > 0) {
        console.log('Migrating local orders to Firebase...');
        localOrders.forEach(order => {
            const id = String(order.id);
            delete order.id; // Let Firebase use its own ID or we use doc(id)
            db.collection('orders').doc(id).set({
                ...order,
                status: order.status || 'pending',
                createdAt: order.createdAt || new Date().toISOString()
            }, { merge: true });
        });
        localStorage.removeItem('deliveryOrders');
    }

    if (localAreas && localAreas.length > 0) {
        console.log('Migrating local areas to Firebase...');
        localAreas.forEach(area => {
            const id = String(area.id);
            delete area.id;
            db.collection('areas').doc(id).set(area, { merge: true });
        });
        localStorage.removeItem('deliveryAreas');
    }
}

    renderOrders();
}

// Add Sync Status Indicator to UI
const syncStatus = document.createElement('div');
syncStatus.id = 'sync-status';
syncStatus.style.cssText = 'position: fixed; bottom: 10px; right: 10px; font-size: 10px; color: var(--text-muted); opacity: 0.5;';
syncStatus.innerText = 'Initializing...';
document.body.appendChild(syncStatus);

function setViewMode(mode) {
    currentViewMode = mode;
    
    // UI Updates
    viewAllBtn.classList.toggle('active', mode === 'all');
    viewBranchBtn.classList.toggle('active', mode === 'branch');
    viewAreaBtn.classList.toggle('active', mode === 'area');
    viewHistoryBtn.classList.toggle('active', mode === 'history');
    
    branchSelectorContainer.classList.toggle('hidden', mode !== 'branch');
    areaSelectorContainer.classList.toggle('hidden', mode !== 'area');
    
    renderOrders();
}

function focusBranch(branchId) {
    focusedBranchId = branchId;
    renderOrders();
}

function focusArea(areaId) {
    focusedAreaId = areaId;
    printDriverBtn.classList.toggle('hidden', !areaId);
    renderOrders();
}

function updateBranchDropdown() {
    // Get unique branches from both "From" and "To" fields
    const branches = new Set();
    orders.forEach(order => {
        branches.add(order.branchFrom);
        branches.add(order.branchTo);
    });

    const sortedBranches = Array.from(branches).sort();
    
    branchSelect.innerHTML = '<option value="">Choose a branch...</option>' + 
        sortedBranches.map(b => `<option value="${b}" ${b === focusedBranchId ? 'selected' : ''}>Branch ${b}</option>`).join('');
}

function updateAreaDropdown() {
    areaSelect.innerHTML = '<option value="">Choose an area...</option>' + 
        areas.map(a => `<option value="${a.id}" ${a.id === focusedAreaId ? 'selected' : ''}>${a.name}</option>`).join('');
}

// Area Management
function toggleAreaManager() {
    areaManagerPanel.classList.toggle('hidden');
}

function addArea() {
    const nameInput = document.getElementById('new-area-name');
    const branchesInput = document.getElementById('new-area-branches');
    
    const name = nameInput.value.trim();
    const branchesStr = branchesInput.value.trim();
    
    if (!name || !branchesStr) {
        alert('Please provide area name and branch IDs.');
        return;
    }
    
    const branches = branchesStr.split(',').map(s => s.trim()).filter(s => s !== "");
    
    const newArea = {
        id: 'area-' + Date.now(),
        name,
        branches
    };
    
    areas.push(newArea);
    saveAreas();
    
    nameInput.value = '';
    branchesInput.value = '';
    
    updateAreaDropdown();
    renderAreas();
}

function deleteArea(id) {
    if (confirm('Delete this area?')) {
        areas = areas.filter(a => a.id !== id);
        saveAreas();
        if (focusedAreaId === id) focusedAreaId = '';
        updateAreaDropdown();
        renderAreas();
        renderOrders();
    }
}

function saveAreas() {
    // No longer needed for LocalStorage
}

function renderAreas() {
    areaListContainer.innerHTML = areas.length === 0 
        ? '<p style="color: var(--text-muted); padding: 1rem;">No areas defined yet.</p>'
        : areas.map(a => `
            <div class="area-item">
                <div class="area-item-info">
                    <strong>${a.name}</strong>
                    <span>Branches: ${a.branches.join(', ')}</span>
                </div>
                <button class="btn-delete-small" onclick="deleteArea('${a.id}')">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
        `).join('');
        
    if (window.lucide) lucide.createIcons();
}

// Add Order Handler
addOrderBtn.addEventListener('click', () => {
    const newOrder = {
        id: String(Date.now()),
        orderNumber: orderFormInputs.orderNumber.value.trim(),
        drugName: orderFormInputs.drugName.value.trim(),
        quantity: orderFormInputs.quantity.value.trim(),
        branchFrom: orderFormInputs.branchFrom.value.trim(),
        branchTo: orderFormInputs.branchTo.value.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    if (validateOrder(newOrder)) {
        db.collection('orders').add(newOrder)
            .then(() => clearForm())
            .catch(err => alert("Error adding order: " + err.message));
    }
});

// Helper Functions
function validateOrder(order) {
    return order.orderNumber && order.drugName && order.quantity && order.branchFrom && order.branchTo;
}

function saveAndRender() {
    // No longer needed as onSnapshot handles rendering
}

function clearForm() {
    Object.values(orderFormInputs).forEach(input => input.value = '');
}

function toggleStatus(id) {
    const order = orders.find(o => String(o.id) === String(id));
    if (order) {
        const newStatus = order.status === 'pending' ? 'delivered' : 'pending';
        db.collection('orders').doc(id).update({ status: newStatus });
    }
}

function deleteOrder(id) {
    if (confirm('Are you sure you want to delete this order?')) {
        db.collection('orders').doc(id).delete();
    }
}

function addArea() {
    const nameInput = document.getElementById('new-area-name');
    const branchesInput = document.getElementById('new-area-branches');
    
    const name = nameInput.value.trim();
    const branchesStr = branchesInput.value.trim();
    
    if (!name || !branchesStr) {
        alert('Please provide area name and branch IDs.');
        return;
    }
    
    const branches = branchesStr.split(',').map(s => s.trim()).filter(s => s !== "");
    
    db.collection('areas').add({ name, branches });
    
    nameInput.value = '';
    branchesInput.value = '';
}

function deleteArea(id) {
    if (confirm('Delete this area?')) {
        db.collection('areas').doc(id).delete();
    }
}

function createOrderCard(order) {
    return `
        <div class="order-card" data-status="${order.status}">
            <div class="order-header">
                <span class="order-number">${order.orderNumber}</span>
                <span class="status-badge status-${order.status}">${order.status}</span>
            </div>
            <div class="order-details">
                <h3 class="drug-name">${order.drugName}</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">${order.quantity}</p>
                <div class="route-info">
                    <span class="branch">${order.branchFrom}</span>
                    <i data-lucide="arrow-right" class="route-arrow"></i>
                    <span class="branch">${order.branchTo}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-toggle" onclick="toggleStatus('${order.id}')">
                    ${order.status === 'pending' ? 'Mark Delivered' : 'Mark Pending'}
                </button>
                <button class="btn-delete" onclick="deleteOrder('${order.id}')">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        </div>
    `;
}

function renderOrders() {
    if (currentViewMode === 'all') {
        ordersList.classList.remove('hidden');
        branchFocusView.classList.add('hidden');
        
        // Ensure we only show pending orders in the main view
        const activeOrders = orders.filter(o => o.status === 'pending');
        console.log('Rendering all active orders:', activeOrders.length);
        
        if (activeOrders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="package-search" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No active delivery orders found.</p>
                </div>
            `;
        } else {
            ordersList.innerHTML = activeOrders.map(order => createOrderCard(order)).join('');
        }
    } else if (currentViewMode === 'history') {
        ordersList.classList.remove('hidden');
        branchFocusView.classList.add('hidden');
        
        const deliveredOrders = orders.filter(o => o.status === 'delivered');
        
        if (deliveredOrders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="archive" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No delivered orders in history.</p>
                </div>
            `;
        } else {
            ordersList.innerHTML = deliveredOrders.map(order => createOrderCard(order)).join('');
        }
    } else {
        ordersList.classList.add('hidden');
        branchFocusView.classList.remove('hidden');
        
        let deliveries = [];
        let collections = [];
        let emptyMessageSuffix = "";

        // Only show pending orders in branch/area views
        const pendingOrders = orders.filter(o => o.status === 'pending');

        if (currentViewMode === 'branch') {
            if (!focusedBranchId) {
                deliverList.innerHTML = '<p class="empty-state">Select a branch to see deliveries.</p>';
                collectList.innerHTML = '<p class="empty-state">Select a branch to see collections.</p>';
                return;
            }
            deliveries = pendingOrders.filter(o => o.branchTo === focusedBranchId);
            collections = pendingOrders.filter(o => o.branchFrom === focusedBranchId);
            emptyMessageSuffix = "here";
        } else if (currentViewMode === 'area') {
            if (!focusedAreaId) {
                deliverList.innerHTML = '<p class="empty-state">Select an area to see deliveries.</p>';
                collectList.innerHTML = '<p class="empty-state">Select an area to see collections.</p>';
                return;
            }
            const area = areas.find(a => a.id === focusedAreaId);
            if (area) {
                deliveries = pendingOrders.filter(o => area.branches.includes(o.branchTo));
                collections = pendingOrders.filter(o => area.branches.includes(o.branchFrom));
                emptyMessageSuffix = "in this area";
            }
        }
            
        deliverList.innerHTML = deliveries.length > 0 
            ? deliveries.map(o => createOrderCard(o)).join('')
            : `<p class="empty-state">No items to deliver ${emptyMessageSuffix}.</p>`;
            
        collectList.innerHTML = collections.length > 0 
            ? collections.map(o => createOrderCard(o)).join('')
            : `<p class="empty-state">No items to collect ${emptyMessageSuffix}.</p>`;
    }

    if (window.lucide) lucide.createIcons();
}

function printDriverSheet() {
    if (!focusedAreaId) return;
    const area = areas.find(a => a.id === focusedAreaId);
    if (!area) return;

    // We use window.print(). The logic is handled by CSS @media print.
    // However, we want to set a title for the printout.
    const originalTitle = document.title;
    document.title = `Driver Manifest - ${area.name} - ${new Date().toLocaleDateString()}`;
    
    // We can also add a temporary header for printing if needed, 
    // but we'll try to do it via CSS first.
    window.print();
    
    document.title = originalTitle;
}
