# 🚗 Intelligent Network Routing Simulation for V2V Communication

## 📖 Overview
This project presents a real-time simulation of **Vehicle-to-Vehicle (V2V) communication** using an intelligent network routing system. It models dynamic vehicular environments and demonstrates how vehicles communicate, discover routes, and adapt to changing network conditions. 

The simulation uses **Dijkstra’s Algorithm** to compute the shortest and most reliable path between vehicles, while considering mobility, interference zones, and real-time network changes.

---

## 🎯 Objectives
- **Design and simulate** an intelligent routing framework for V2V communication.
- **Implement Dijkstra’s Algorithm** for optimal path discovery.
- **Analyze performance** using metrics like:
  - Packet Delivery Ratio (PDR)
  - Latency
  - Throughput
- **Study the impact** of:
  - Vehicle mobility
  - Network density
  - Interference zones
- **Provide real-time visualization** of routing behavior.

---

## 🧠 Key Concepts

### V2V Communication (VANET)
Vehicles act as mobile nodes forming a **Vehicular Ad-hoc Network (VANET)** to exchange information such as traffic updates, hazards, and routing data.

### Routing Algorithm
- **Dijkstra’s Algorithm:** - Finds the shortest path (minimum distance).
  - Ensures efficient and reliable communication.
  - Dynamically recalculates routes when network conditions change.

---

## 🏗️ System Architecture
The system is divided into the following functional layers:
- 🚙 **Vehicle Layer:** Represents moving vehicles as nodes.
- 📡 **Communication Layer:** Enables V2V data exchange (DSRC/IEEE 802.11p).
- 🔀 **Routing Layer:** Implements Dijkstra’s Algorithm.
- 🌍 **Simulation Layer:** Handles mobility, topology, and interference.
- 📊 **Performance Layer:** Computes metrics (PDR, latency, throughput).
- 💻 **Visualization Layer:** Displays the real-time simulation.

---

## ✨ Features
- 🟢 Real-time vehicle movement simulation
- 🔄 Dynamic route recalculation
- 🚧 Interference-aware routing
- 🎛️ Interactive dashboard
- 📈 Live performance metrics visualization
- 📈 Scalable for multiple vehicles

---

## 💻 Tech Stack
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS
- **Maps:** Leaflet / OpenStreetMap
- **Visualization:** Canvas / Charts (Recharts)
- **Routing Logic:** Dijkstra’s Algorithm

---

## 🚀 Getting Started

Follow these steps to run the simulation locally:

**1. Clone the Repository**
```bash
git clone [https://github.com/your-username/v2v-routing-simulation.git](https://github.com/your-username/v2v-routing-simulation.git)
cd v2v-routing-simulation
2. Install Dependencies

Bash
npm install
3. Run the Project

Bash
npm run dev
4. Open in Browser
Navigate to http://localhost:5173 in your preferred web browser.

⚙️ How It Works
Vehicles move dynamically on a simulated road network.

Communication links are established based on proximity.

Routes are calculated using Dijkstra’s Algorithm.

Interference zones disrupt paths, which triggers immediate rerouting.

Performance metrics are updated and displayed in real-time.

🔮 Future Enhancements
[ ] Integration with real traffic datasets.

[ ] Support for advanced routing protocols (AODV, DSDV).

[ ] AI-based predictive routing.

[ ] Backend simulation using WebSockets.

[ ] Deployment for smart city applications.

📄 License
This project is developed for academic and research purposes.

🏁 Conclusion
This project demonstrates how intelligent routing strategies can significantly improve efficiency, reliability, and adaptability in vehicular networks. It highlights the importance of real-time decision-making and dynamic route optimization in modern transportation systems.
