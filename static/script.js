// Global State
const numLanes = 4;
let activeLane = 1;
let timeRemaining = 10; // Default starting time
let isEmergency = false;

// Lane Configuration State
// Default green time is 10 seconds for all lanes initially
const laneData = {
    1: { greenTime: 10, density: 'Low' },
    2: { greenTime: 10, density: 'Low' },
    3: { greenTime: 10, density: 'Low' },
    4: { greenTime: 10, density: 'Low' }
};

// Initialize the system
function init() {
    updateSignals();
    fetchAnalytics();
    
    // Main timer loop (runs every second)
    setInterval(() => {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerDisplay();
            
            // Yellow light logic (last 3 seconds)
            if (timeRemaining === 3 && !isEmergency) {
                setYellowLight(activeLane);
            }
        } else {
            // Time is up, switch to next lane
            isEmergency = false; // Reset emergency state when time is up
            switchToNextLane();
        }
    }, 1000);

    // Analytics refresh loop (every 10 seconds)
    setInterval(fetchAnalytics, 10000);
}

// Update the visual timer for all lanes
function updateTimerDisplay() {
    for (let i = 1; i <= numLanes; i++) {
        const timerEl = document.getElementById(`timer-${i}`);
        if (i === activeLane) {
            timerEl.textContent = timeRemaining.toString().padStart(2, '0');
            timerEl.style.color = timeRemaining <= 3 ? '#f59e0b' : '#10b981'; // Yellow warning
        } else {
            timerEl.textContent = "00";
            timerEl.style.color = "#334155";
        }
    }
}

// Switch signals to reflect the currently active lane
function updateSignals() {
    for (let i = 1; i <= numLanes; i++) {
        const redLight = document.getElementById(`light-red-${i}`);
        const yellowLight = document.getElementById(`light-yellow-${i}`);
        const greenLight = document.getElementById(`light-green-${i}`);

        // Reset all to dim
        redLight.classList.remove('active');
        yellowLight.classList.remove('active');
        greenLight.classList.remove('active');

        if (i === activeLane) {
            greenLight.classList.add('active'); // Active lane is green
        } else {
            redLight.classList.add('active'); // Others are red
        }
    }
    updateTimerDisplay();
}

// Transition to yellow light
function setYellowLight(lane) {
    document.getElementById(`light-green-${lane}`).classList.remove('active');
    document.getElementById(`light-yellow-${lane}`).classList.add('active');
}

// Move to the next lane in the cycle
function switchToNextLane() {
    activeLane++;
    if (activeLane > numLanes) {
        activeLane = 1;
    }
    
    // Set timer based on the specific lane's calculated green time
    timeRemaining = laneData[activeLane].greenTime;
    updateSignals();
}

// ==========================================
// API Interaction Functions
// ==========================================

// 1. Submit manual vehicle count to update density and green time
async function updateDensity(laneId) {
    const inputEl = document.getElementById(`count-${laneId}`);
    const vehicleCount = inputEl.value;

    if (vehicleCount === "") {
        alert("Please enter a vehicle count.");
        return;
    }

    try {
        const response = await fetch('/api/update_density', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lane_id: laneId, vehicle_count: vehicleCount })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // Update local state
            laneData[laneId].greenTime = data.green_time;
            laneData[laneId].density = data.density;

            // Update UI Labels
            document.getElementById(`density-${laneId}`).textContent = `Density: ${data.density}`;
            
            // Highlight density color
            const densityEl = document.getElementById(`density-${laneId}`);
            if (data.density === 'Low') densityEl.style.color = '#10b981';
            if (data.density === 'Medium') densityEl.style.color = '#f59e0b';
            if (data.density === 'High') densityEl.style.color = '#ef4444';

            // Clear input
            inputEl.value = "";
            
            // Immediate feedback
            fetchAnalytics(); 
        }
    } catch (error) {
        console.error("Error updating density:", error);
    }
}

// 2. Trigger Emergency Mode
async function triggerEmergency(laneId) {
    try {
        const response = await fetch('/api/emergency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lane_id: laneId })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // Force active lane to be the emergency lane immediately
            activeLane = laneId;
            timeRemaining = 30; // Give emergency vehicle 30 seconds
            isEmergency = true;
            updateSignals();
        }
    } catch (error) {
        console.error("Error triggering emergency:", error);
    }
}

// 3. Fetch Analytics Data
async function fetchAnalytics() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Update top bar stats
        document.getElementById('total-vehicles').textContent = data.total_vehicles || 0;
        document.getElementById('peak-hour').textContent = data.peak_hour || 'N/A';

        // Update Hourly Table
        const tbody = document.getElementById('hourly-table-body');
        tbody.innerHTML = ''; // Clear existing
        
        if (data.hourly_data && data.hourly_data.length > 0) {
            data.hourly_data.forEach(row => {
                const tr = document.createElement('tr');
                
                // Format hour (e.g., 14 -> 14:00)
                const timeString = `${row.hour.toString().padStart(2, '0')}:00`;
                
                tr.innerHTML = `
                    <td>${timeString}</td>
                    <td>${row.total_volume} vehicles</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align: center;">No data recorded yet today</td></tr>`;
        }
        
    } catch (error) {
        console.error("Error fetching analytics:", error);
    }
}

// Run init when page loads
window.onload = init;
