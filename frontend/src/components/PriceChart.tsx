import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PriceData {
  date: string;
  price: number;
  volume?: number;
}

interface PriceChartProps {
  data: PriceData[];
  compact?: boolean;
  showVolume?: boolean;
}

export default function PriceChart({ data, compact = false, showVolume = false }: PriceChartProps) {
  const isDark = document.documentElement.classList.contains('dark');

  const colors = {
    grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    text: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
    line: '#0ea5e9',
    fill: compact ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.15)',
    volume: 'rgba(14,165,233,0.2)',
  };

  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Price',
        data: data.map(d => d.price),
        borderColor: colors.line,
        backgroundColor: colors.fill,
        fill: true,
        tension: 0.3,
        pointRadius: compact ? 0 : 1,
        pointHoverRadius: compact ? 0 : 4,
        borderWidth: compact ? 1.5 : 2,
      },
    ],
  };

  const volumeData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Volume',
        data: data.map(d => d.volume || 0),
        backgroundColor: colors.volume,
        borderRadius: 2,
      },
    ],
  };

  const baseOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor: isDark ? '#fff' : '#111',
        bodyColor: isDark ? '#d1d5db' : '#4b5563',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: compact ? {
      x: {
        grid: { display: false },
        ticks: { display: false },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { display: false },
        border: { display: false },
      },
    } : {
      x: {
        grid: { color: colors.grid },
        ticks: {
          color: colors.text,
          maxTicksLimit: 6,
          font: { size: 10 },
        },
        border: { color: colors.grid },
      },
      y: {
        grid: { color: colors.grid },
        ticks: {
          color: colors.text,
          callback: (value: number) => `₹${value.toLocaleString('en-IN')}`,
          font: { size: 10 },
        },
        border: { color: colors.grid },
      },
    },
  };

  return (
    <div className={`w-full ${showVolume ? 'h-64' : compact ? 'h-16' : 'h-64'}`}>
      <Line data={chartData} options={baseOptions} />
      {showVolume && data.length > 0 && (
        <div className="h-16 mt-2">
          <Bar data={volumeData} options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false, grid: { display: false } },
              y: { display: false, grid: { display: false } },
            },
          }} />
        </div>
      )}
    </div>
  );
}
