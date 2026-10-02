"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

interface Props {
  children: ReactNode;
  /** Hata durumunda gösterilecek kısa başlık. */
  title?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Sunucu/API hatalarını yakalayıp kullanıcıya kontrollü bir ekran gösterir. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950/20 p-5">
        <BrandLogo size={36} className="mb-3 rounded-md" />
        <h2 className="text-sm font-medium text-rose-200">{this.props.title ?? "Veriler yüklenemedi"}</h2>
        <p className="mt-2 text-xs leading-relaxed text-rose-300/80">
          {this.state.message || "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin."}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white"
        >
          Tekrar dene
        </button>
      </div>
    );
  }
}
