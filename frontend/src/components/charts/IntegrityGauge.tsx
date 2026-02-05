import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Text } from 'recharts';

interface IntegrityGaugeProps { score: number; }

const IntegrityGauge: React.FC<IntegrityGaugeProps> = ({ score }) => {
    // Normalize score to 0-100 range for safety
    const displayScore = Math.min(100, Math.max(0, score));
    const data = [
        { name: 'Integrity', value: displayScore },
        { name: 'Remaining', value: 100 - displayScore }
    ];

    const getGaugeColor = (val: number) => {
        if (val < 50) return '#ef4444'; // Red-500
        if (val < 85) return '#f59e0b'; // Amber-500
        return '#10b981'; // Emerald-500
    };

    return (
        <div className="flex flex-col items-center justify-center h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="70%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={65}
                        outerRadius={90}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell key="cell-0" fill={getGaugeColor(displayScore)} />
                        <Cell key="cell-1" fill="#f1f5f9" />
                    </Pie>
                    <Text
                        x="50%"
                        y="60%"
                        textAnchor="middle"
                        verticalAnchor="middle"
                        style={{ fontSize: '32px', fontWeight: 'bold', fill: '#0f172a' }}
                    >
                        {`${Math.round(displayScore)}%`}
                    </Text>
                    <Text
                        x="50%"
                        y="80%"
                        textAnchor="middle"
                        verticalAnchor="middle"
                        style={{ fontSize: '12px', fill: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                        Data Health Score
                    </Text>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default IntegrityGauge;
