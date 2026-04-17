// src/widgets/CarbonChart.jsx
import React from "react";
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer } from "recharts";
import { kgHaToKgAcre } from "../utils/unitConversion";

export default function CarbonChart({ co2 }) {
  // Convert from kg/ha to kg/acre for display
  const co2Acre = kgHaToKgAcre(Number(co2)) || 0;
  // show co2 against a chosen max for visual
  const max = Math.max(1, co2Acre * 2);
  const data = [{ name: "CO2eq", value: co2Acre, fill: "#b45309" }];
  return (
    <div style={{ minWidth: 0, minHeight: 180 }}>
      <h4 className="font-semibold mb-2">Carbon (kg CO₂-eq / acre)</h4>
      <ResponsiveContainer width="100%" height={180}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" barSize={20} data={data}>
          <RadialBar background dataKey="value" minAngle={15} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center mt-2 font-bold">{co2Acre.toFixed(1)} kg CO₂-eq/acre</div>
    </div>
  );
}