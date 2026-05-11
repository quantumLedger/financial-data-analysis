"use client";

import React, { useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Download } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartData } from "@/types/chart";

function downloadChartAsPng(containerEl: HTMLElement, title: string) {
  const svgEl = containerEl.querySelector("svg");
  if (!svgEl) return;

  const width = svgEl.clientWidth || 600;
  const height = svgEl.clientHeight || 400;

  // Clone and inline computed fill/stroke so colors survive leaving the DOM
  const cloned = svgEl.cloneNode(true) as SVGElement;
  cloned.setAttribute("width", String(width));
  cloned.setAttribute("height", String(height));

  const origAll = [svgEl, ...Array.from(svgEl.querySelectorAll("*"))];
  const clonedAll = [cloned, ...Array.from(cloned.querySelectorAll("*"))];
  origAll.forEach((el, i) => {
    const target = clonedAll[i] as SVGElement;
    const cs = window.getComputedStyle(el);
    const fill = cs.getPropertyValue("fill");
    const stroke = cs.getPropertyValue("stroke");
    if (fill) target.style.fill = fill;
    if (stroke) target.style.stroke = stroke;
  });

  const svgStr = new XMLSerializer().serializeToString(cloned);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${(title || "chart").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
    link.click();
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function BarChartComponent({ data }: { data: ChartData }) {
  const dataKey = Object.keys(data.chartConfig)[0];
  // Ensure data.data is an array
  const safeData = Array.isArray(data.data) ? data.data : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">{data.config.title}</CardTitle>
        <CardDescription className="text-[12px]">{data.config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={data.chartConfig}>
          <BarChart accessibilityLayer data={safeData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={data.config.xAxisKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                return value.length > 20
                  ? `${value.substring(0, 17)}...`
                  : value;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey={dataKey}
              fill={`var(--color-${dataKey})`}
              radius={8}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-[12px]">
        {data.config.trend && (
          <div className="flex gap-2 font-medium leading-none">
            Trending {data.config.trend.direction} by{" "}
            {data.config.trend.percentage}% this period{" "}
            {data.config.trend.direction === "up" ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
          </div>
        )}
        {data.config.footer && (
          <div className="leading-none text-muted-foreground">
            {data.config.footer}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function MultiBarChartComponent({ data }: { data: ChartData }) {
  // Ensure data.data is an array
  const safeData = Array.isArray(data.data) ? data.data : [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">{data.config.title}</CardTitle>
        <CardDescription className="text-[12px]">{data.config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={data.chartConfig}>
          <BarChart accessibilityLayer data={safeData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={data.config.xAxisKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                return value.length > 20
                  ? `${value.substring(0, 17)}...`
                  : value;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            {Object.keys(data.chartConfig).map((key) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={4}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-[12px]">
        {data.config.trend && (
          <div className="flex gap-2 font-medium leading-none">
            Trending {data.config.trend.direction} by{" "}
            {data.config.trend.percentage}% this period{" "}
            {data.config.trend.direction === "up" ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
          </div>
        )}
        {data.config.footer && (
          <div className="leading-none text-muted-foreground">
            {data.config.footer}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function LineChartComponent({ data }: { data: ChartData }) {
  // Ensure data.data is an array
  const safeData = Array.isArray(data.data) ? data.data : [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">{data.config.title}</CardTitle>
        <CardDescription className="text-[12px]">{data.config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={data.chartConfig}>
          <LineChart
            accessibilityLayer
            data={safeData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={data.config.xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                return value.length > 20
                  ? `${value.substring(0, 17)}...`
                  : value;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            {Object.keys(data.chartConfig).map((key) => (
              <Line
                key={key}
                type="natural"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-[12px]">
        {data.config.trend && (
          <div className="flex gap-2 font-medium leading-none">
            Trending {data.config.trend.direction} by{" "}
            {data.config.trend.percentage}% this period{" "}
            {data.config.trend.direction === "up" ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
          </div>
        )}
        {data.config.footer && (
          <div className="leading-none text-muted-foreground">
            {data.config.footer}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function PieChartComponent({ data }: { data: ChartData }) {
  // Ensure data.data is an array
  const safeData = Array.isArray(data.data) ? data.data : [];
  
  const totalValue = React.useMemo(() => {
    if (!Array.isArray(safeData) || safeData.length === 0) return 0;
    return safeData.reduce((acc, curr) => acc + (curr?.value || 0), 0);
  }, [safeData]);

  const chartData = safeData.map((item, index) => {
    return {
      ...item,
      // Use the same color variable pattern as other charts
      fill: `hsl(var(--chart-${index + 1}))`,
    };
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-h5">{data.config.title}</CardTitle>
        <CardDescription>{data.config.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={data.chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="segment"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-[18px] font-bold"
                        >
                          {totalValue.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-[12px]"
                        >
                          {data.config.totalLabel}
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-[12px]">
        {data.config.trend && (
          <div className="flex items-center gap-2 font-medium leading-none">
            Trending {data.config.trend.direction} by{" "}
            {data.config.trend.percentage}% this period{" "}
            {data.config.trend.direction === "up" ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
          </div>
        )}
        {data.config.footer && (
          <div className="leading-none text-muted-foreground">
            {data.config.footer}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function AreaChartComponent({
  data,
  stacked,
}: {
  data: ChartData;
  stacked?: boolean;
}) {
  // Ensure data.data is an array
  const safeData = Array.isArray(data.data) ? data.data : [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">{data.config.title}</CardTitle>
        <CardDescription className="text-[12px]">{data.config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={data.chartConfig}>
          <AreaChart
            accessibilityLayer
            data={safeData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={data.config.xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                return value.length > 20
                  ? `${value.substring(0, 17)}...`
                  : value;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent indicator={stacked ? "dot" : "line"} />
              }
            />
            {Object.keys(data.chartConfig).map((key) => (
              <Area
                key={key}
                type="natural"
                dataKey={key}
                fill={`var(--color-${key})`}
                fillOpacity={0.4}
                stroke={`var(--color-${key})`}
                stackId={stacked ? "a" : undefined}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-[12px]">
          <div className="grid gap-2">
            {data.config.trend && (
              <div className="flex items-center gap-2 font-medium leading-none">
                Trending {data.config.trend.direction} by{" "}
                {data.config.trend.percentage}% this period{" "}
                {data.config.trend.direction === "up" ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
            )}
            {data.config.footer && (
              <div className="leading-none text-muted-foreground">
                {data.config.footer}
              </div>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

export function ChartRenderer({ data }: { data: ChartData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const downloadPng = useCallback(() => {
    if (!containerRef.current) return;
    downloadChartAsPng(containerRef.current, data.config.title || "chart");
  }, [data.config.title]);

  let chart: React.ReactNode = null;
  switch (data.chartType) {
    case "bar":
      chart = <BarChartComponent data={data} />;
      break;
    case "multiBar":
      chart = <MultiBarChartComponent data={data} />;
      break;
    case "line":
      chart = <LineChartComponent data={data} />;
      break;
    case "pie":
      chart = <PieChartComponent data={data} />;
      break;
    case "area":
      chart = <AreaChartComponent data={data} />;
      break;
    case "stackedArea":
      chart = <AreaChartComponent data={data} stacked />;
      break;
    default:
      return null;
  }

  return (
    <div ref={containerRef} className="relative group">
      <button
        onClick={downloadPng}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
        title="Download chart as PNG"
      >
        <Download className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {chart}
    </div>
  );
}
