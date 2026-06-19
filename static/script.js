// Global State
const numLanes = 4;
let activeLane = 1;
let timeRemaining = 10; // Default starting time
let isEmergency = false;
let simulationInterval = null;
let trafficChart = null;

const laneNames = {
    1: 'North Lane',
    2: 'South Lane',
    3: 'East Lane',
    4: 'West Lane'
};

// Lane Configuration State
const laneData = {
    1: { greenTime: 10, density: 'Low' },
    2: { greenTime: 10, density: 'Low' },
    3: { greenTime: 10, density: 'Low' },
    4: { greenTime: 10, density: 'Low' }
};

// Initialize the system
function init() {
    setupChart();
    updateSignals();
    fetchAnalytics();
    fetchEmergencyHistory();
    
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

    // Analytics and logs refresh loop (every 10 seconds)
    setInterval(() => {
        fetchAnalytics();
        fetchEmergencyHistory();
    }, 10000);

    // Setup Simulation Event Listener
    const simToggle = document.getElementById('simulation-toggle');
    simToggle.addEventListener('change', (e) => {
        toggleSimulation(e.target.checked);
    });
}

// Update the visual timer for all lanes
function updateTimerDisplay() {
    for (let i = 1; i <= numLanes; i++) {
        const timerEl = document.getElementById(`timer-${i}`);
        if (i === activeLane) {
            timerEl.textContent = timeRemaining.toString().padStart(2, '0');
            
            // Text color coding
            if (isEmergency) {
                timerEl.style.color = '#ef4444'; // Red for emergency countdown
            } else if (timeRemaining <= 3) {
                timerEl.style.color = '#fbbf24'; // Yellow warning
            } else {
                timerEl.style.color = '#10b981'; // Green active
            }
        } else {
            timerEl.textContent = "00";
            timerEl.style.color = "#64748b";
        }
    }
}

// Switch signals to reflect the currently active lane
function updateSignals() {
    // Update active lane header indicator
    document.getElementById('active-lane-indicator').textContent = laneNames[activeLane];

    for (let i = 1; i <= numLanes; i++) {
        const laneCard = document.getElementById(`lane-${i}`);
        const redLight = document.getElementById(`light-red-${i}`);
        const yellowLight = document.getElementById(`light-yellow-${i}`);
        const greenLight = document.getElementById(`light-green-${i}`);

        // Reset all active classes
        redLight.classList.remove('active');
        yellowLight.classList.remove('active');
        greenLight.classList.remove('active');
        laneCard.classList.remove('active-lane');

        if (i === activeLane) {
            greenLight.classList.add('active'); // Active lane is green
            laneCard.classList.add('active-lane');
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
// Simulation Logic
// ==========================================

function toggleSimulation(isRunning) {
    const statusLabel = document.getElementById('sim-status-label');
    if (isRunning) {
        statusLabel.textContent = "Running";
        statusLabel.style.color = "#10b981";
        
        // Inject random vehicle volume into a random lane every 5 seconds
        simulationInterval = setInterval(() => {
            const randomLane = Math.floor(Math.random() * numLanes) + 1;
            const randomCount = Math.floor(Math.random() * 85) + 5; // 5 to 90 vehicles
            
            // Set input field value visually
            document.getElementById(`count-${randomLane}`).value = randomCount;
            // Update density on backend
            updateDensity(randomLane, true);
        }, 5000);
    } else {
        statusLabel.textContent = "Inactive";
        statusLabel.style.color = "#64748b";
        
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
        }
    }
}

// ==========================================
// API Interaction Functions
// ==========================================

// 1. Submit vehicle count to update density and green time
async function updateDensity(laneId, isSimulated = false) {
    const inputEl = document.getElementById(`count-${laneId}`);
    const vehicleCount = inputEl.value;

    if (vehicleCount === "") {
        if (!isSimulated) alert("Please enter a vehicle count.");
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

            // If we updated the currently active lane, dynamically adjust the remaining green time
            if (laneId === activeLane && !isEmergency) {
                // If the user inserts high volume, give them the extra time
                timeRemaining = data.green_time;
            }

            // Update UI Labels
            document.getElementById(`density-${laneId}`).textContent = `Density: ${data.density}`;
            
            // Highlight density color
            const densityEl = document.getElementById(`density-${laneId}`);
            if (data.density === 'Low') {
                densityEl.style.color = '#10b981';
                densityEl.style.background = 'rgba(16, 185, 129, 0.08)';
            } else if (data.density === 'Medium') {
                densityEl.style.color = '#fbbf24';
                densityEl.style.background = 'rgba(251, 191, 36, 0.08)';
            } else if (data.density === 'High') {
                densityEl.style.color = '#ef4444';
                densityEl.style.background = 'rgba(239, 68, 68, 0.08)';
            }

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
            fetchEmergencyHistory();
            fetchAnalytics();
        }
    } catch (error) {
        console.error("Error triggering emergency:", error);
    }
}

// 3. Fetch Analytics Data & Update Chart.js
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
                const timeString = `${row.hour.toString().padStart(2, '0')}:00`;
                
                tr.innerHTML = `
                    <td><strong>${timeString}</strong></td>
                    <td>${row.total_volume} veh</td>
                `;
                tbody.appendChild(tr);
            });
            
            // Update chart rendering
            updateChartData(data.hourly_data);
        } else {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No records</td></tr>`;
            // Empty chart state
            updateChartData([]);
        }
        
    } catch (error) {
        console.error("Error fetching analytics:", error);
    }
}

// 4. Fetch Emergency History Logs
async function fetchEmergencyHistory() {
    try {
        const response = await fetch('/api/emergency_history');
        const logs = await response.json();
        
        const logsList = document.getElementById('emergency-logs-list');
        const emergencyCountEl = document.getElementById('emergency-count');
        
        logsList.innerHTML = ''; // Clear existing
        emergencyCountEl.textContent = logs.length;

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const li = document.createElement('li');
                li.className = 'log-item';
                
                // Format relative or clean time
                const formattedTime = new Date(log.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                li.innerHTML = `
                    <span class="log-item-icon">🚨</span>
                    <div class="log-item-details">
                        <span class="log-item-lane">${log.lane_name} Override</span>
                        <span class="log-item-time">${formattedTime}</span>
                    </div>
                `;
                logsList.appendChild(li);
            });
        } else {
            logsList.innerHTML = `<li style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px 0;">No emergency events logged today.</li>`;
        }
    } catch (error) {
        console.error("Error fetching emergency history:", error);
    }
}

// ==========================================
// Chart.js Configuration
// ==========================================

function setupChart() {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.01)');

    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Hourly Volume',
                data: [],
                borderColor: '#38bdf8',
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#0b0f19',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Hide legend
                },
                tooltip: {
                    backgroundColor: '#161e31',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    displayColors: false,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            family: 'Outfit',
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            family: 'Outfit',
                            size: 11
                        },
                        stepSize: 10
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

function updateChartData(hourlyData) {
    if (!trafficChart) return;
    
    // Sort hourlyData by hour
    const sorted = [...hourlyData].sort((a, b) => a.hour - b.hour);
    
    const labels = sorted.map(d => `${d.hour.toString().padStart(2, '0')}:00`);
    const values = sorted.map(d => d.total_volume);
    
    trafficChart.data.labels = labels;
    trafficChart.data.datasets[0].data = values;
    trafficChart.update();
}

// Run init when page loads
window.onload = init;
