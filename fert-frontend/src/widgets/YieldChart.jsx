// src/widgets/YieldChart.jsx
import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { kgHaToKgAcre } from "../utils/unitConversion";

export default function YieldChart({ yieldKg }) {
  // Convert from kg/ha to kg/acre for display
  const y = kgHaToKgAcre(Number(yieldKg)) || 0;
  const data = [
    { name: "Predicted", value: y },
  ];
  return (
    <div style={{ width: "100%", height: 180, minWidth: 0, minHeight: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="name"/>
          <YAxis/>
          <Tooltip/>
          <Line type="monotone" dataKey="value" stroke="#2f855a" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}