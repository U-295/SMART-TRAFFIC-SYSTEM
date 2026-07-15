// Global State representing the active intersection monitor configuration
/**
 * @type {number} Total number of traffic lanes
 * @type {number} Currently active green lane ID (1-4)
 * @type {number} Remaining seconds for active green light duration
 * @type {boolean} State flag indicating active emergency priority mode
 * @type {boolean} State flag indicating active pedestrian walk priority mode
 */
const numLanes = 4;
let activeLane = 1;
let timeRemaining = 10; // Default starting time
let isEmergency = false;
let isPedestrian = false;
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
            if (timeRemaining === 3 && !isEmergency && !isPedestrian) {
                setYellowLight(activeLane);
            }
        } else {
            // Time is up, switch to next lane
            isEmergency = false; // Reset emergency state when time is up
            isPedestrian = false;
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

    // Fetch and setup Weather
    fetchWeather();
    const weatherBtns = document.querySelectorAll('.weather-btn');
    weatherBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedWeather = e.currentTarget.getAttribute('data-weather');
            changeWeather(selectedWeather);
        });
    });

    // Initial config load
    fetchConfiguration();

    // Initial logs load
    fetchFilteredLogs();
}

// Update the visual timer for all lanes
function updateTimerDisplay() {
    for (let i = 1; i <= numLanes; i++) {
        const timerEl = document.getElementById(`timer-${i}`);
        if (i === activeLane) {
            if (isPedestrian) {
                timerEl.textContent = "🚶 " + timeRemaining.toString().padStart(2, '0');
                timerEl.style.color = '#10b981';
            } else {
                timerEl.textContent = timeRemaining.toString().padStart(2, '0');
            }
            
            // Text color coding
            if (isEmergency) {
                timerEl.style.color = '#ef4444'; // Red for emergency countdown
            } else if (isPedestrian) {
                // Keep pedestrian walking green
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
            isPedestrian = false;
            updateSignals();
            fetchEmergencyHistory();
            fetchAnalytics();
        }
    } catch (error) {
        console.error("Error triggering emergency:", error);
    }
}

// 2.5 Trigger Pedestrian Crossing Priority
async function requestPedestrian(laneId) {
    try {
        const response = await fetch('/api/pedestrian_crossing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lane_id: laneId })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            // Give 15 seconds pedestrian crossing window
            activeLane = laneId;
            timeRemaining = 15;
            isPedestrian = true;
            isEmergency = false;
            updateSignals();
            fetchAnalytics();
        }
    } catch (error) {
        console.error("Error requesting pedestrian crossing:", error);
    }
}

// ==========================================
// Weather Logic
// ==========================================

const weatherMultipliers = {
    'Clear': 1.0,
    'Rain': 1.5,
    'Fog': 1.3,
    'Snow': 1.8
};

async function fetchWeather() {
    try {
        const response = await fetch('/api/weather');
        const data = await response.json();
        updateWeatherUI(data.weather);
    } catch (error) {
        console.error("Error fetching weather:", error);
    }
}

async function changeWeather(weather) {
    try {
        const response = await fetch('/api/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weather })
        });
        const data = await response.json();
        if (data.status === 'success') {
            updateWeatherUI(data.weather);
            fetchAnalytics();
        }
    } catch (error) {
        console.error("Error changing weather:", error);
    }
}

function updateWeatherUI(weather) {
    const statusLabel = document.getElementById('weather-status-label');
    const multiplier = weatherMultipliers[weather] || 1.0;
    if (statusLabel) {
        statusLabel.textContent = `${weather} (${multiplier}x)`;
    }
    const weatherBtns = document.querySelectorAll('.weather-btn');
    weatherBtns.forEach(btn => {
        if (btn.getAttribute('data-weather') === weather) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
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

// Fetch logs with current filters applied
async function fetchFilteredLogs() {
    const laneSelect = document.getElementById('filter-lane');
    const densitySelect = document.getElementById('filter-density');
    
    // Check if element exists before accessing values (useful during tests)
    const laneId = laneSelect ? laneSelect.value : '';
    const density = densitySelect ? densitySelect.value : '';
    
    let url = '/api/logs?limit=50';
    if (laneId) url += `&lane_id=${laneId}`;
    if (density) url += `&density=${density}`;
    
    try {
        const response = await fetch(url);
        const logs = await response.json();
        
        const tbody = document.getElementById('filtered-logs-body');
        if (!tbody) return; // Exit if tbody isn't loaded yet
        
        tbody.innerHTML = '';
        
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const tr = document.createElement('tr');
                let densityColor = '#64748b';
                if (log.density_level === 'Low') densityColor = '#10b981';
                else if (log.density_level === 'Medium') densityColor = '#fbbf24';
                else if (log.density_level === 'High') densityColor = '#ef4444';
                
                tr.innerHTML = `
                    <td><strong>${log.lane_name}</strong></td>
                    <td>${log.vehicle_count}</td>
                    <td><span style="color: ${densityColor}; font-weight: 600;">${log.density_level}</span></td>
                    <td>${log.green_time}s</td>
                    <td>${log.recorded_at}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No logs found matching filters.</td></tr>`;
        }
    } catch (error) {
        console.error("Error fetching filtered logs:", error);
    }
}

function exportLogsCSV() {
    const laneSelect = document.getElementById('filter-lane');
    const densitySelect = document.getElementById('filter-density');
    const laneId = laneSelect ? laneSelect.value : '';
    const density = densitySelect ? densitySelect.value : '';
    
    let url = '/api/logs/export?';
    if (laneId) url += `lane_id=${laneId}&`;
    if (density) url += `density=${density}&`;
    
    window.location.href = url;
}

async function fetchConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        const thLowInput = document.getElementById('cfg-th-low');
        const thMedInput = document.getElementById('cfg-th-med');
        const gtLowInput = document.getElementById('cfg-gt-low');
        const gtMedInput = document.getElementById('cfg-gt-med');
        const gtHighInput = document.getElementById('cfg-gt-high');
        
        if (thLowInput) thLowInput.value = config.threshold_low;
        if (thMedInput) thMedInput.value = config.threshold_medium;
        if (gtLowInput) gtLowInput.value = config.green_time_low;
        if (gtMedInput) gtMedInput.value = config.green_time_medium;
        if (gtHighInput) gtHighInput.value = config.green_time_high;
    } catch (error) {
        console.error("Error fetching configuration:", error);
    }
}

async function saveConfiguration() {
    const threshold_low = document.getElementById('cfg-th-low').value;
    const threshold_medium = document.getElementById('cfg-th-med').value;
    const green_time_low = document.getElementById('cfg-gt-low').value;
    const green_time_medium = document.getElementById('cfg-gt-med').value;
    const green_time_high = document.getElementById('cfg-gt-high').value;
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threshold_low,
                threshold_medium,
                green_time_low,
                green_time_medium,
                green_time_high
            })
        });
        const data = await response.json();
        if (data.status === 'success') {
            alert("Settings saved successfully!");
        }
    } catch (error) {
        console.error("Error saving configuration:", error);
        alert("Failed to save settings.");
    }
}

// Run init when page loads
window.onload = init;
