"use client";
import dynamic from "next/dynamic";
export const FeedPage = dynamic(() => import("@/components/feed/FeedPage"), { ssr: false });
