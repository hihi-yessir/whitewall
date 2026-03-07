"use client";
import dynamic from "next/dynamic";
export const DemoPage = dynamic(() => import("@/components/demo/DemoPage"), { ssr: false });
