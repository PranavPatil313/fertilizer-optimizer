// src/widgets/NpkChart.jsx
import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { kgHaToKgAcre } from "../utils/unitConversion";

export default function NpkChart({ N, P, K }) {
  // Convert from kg/ha to kg/acre for display
  const data = [
    { name: "N", value: kgHaToKgAcre(Number(N)) || 0 },
    { name: "P", value: kgHaToKgAcre(Number(P)) || 0 },
    { name: "K", value: kgHaToKgAcre(Number(K)) || 0 },
  ];
  return (
    <div style={{ width: "100%", height: 180, minWidth: 0, minHeight: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" >
            <LabelList dataKey="value" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}