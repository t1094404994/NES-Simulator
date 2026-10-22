import * as echarts from 'echarts';
import type { EChartsCoreOption } from 'echarts';
import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

export function Chart({ option, height }: { option: EChartsCoreOption; height: number }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    const chart = echarts.init(node);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(node);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <Box ref={nodeRef} sx={{ width: '100%', height }} />;
}
