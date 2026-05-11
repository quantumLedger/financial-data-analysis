// types/chart.ts

export interface TableColumn {
  key: string;
  label: string;
  type: "text" | "number" | "percent" | "currency" | "badge";
  align?: "left" | "right" | "center";
}

export interface TableData {
  title: string;
  description?: string;
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
  footer?: string;
}

export interface MemoData {
  title: string;
  company?: string;
  date?: string;
  executive_summary: string;
  analysis: string;
  risks: string[];
  recommendation: string;
}

export interface NarrativeData {
  narrative: string;
  tone?: "formal" | "conversational" | "executive";
}

export interface ChartConfig {
  [key: string]: {
    label: string;
    stacked?: boolean;
    color?: string;
  };
}

export interface ChartData {
  chartType: "bar" | "multiBar" | "line" | "pie" | "area" | "stackedArea";
  config: {
    title: string;
    description: string;
    trend?: {
      percentage: number;
      direction: "up" | "down";
    };
    footer?: string;
    totalLabel?: string;
    xAxisKey?: string;
  };
  data: Array<Record<string, any>>;
  chartConfig: ChartConfig;
}
