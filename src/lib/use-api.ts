"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { request, requestList, type RequestOptions } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";

interface QuerySnapshot<T> {
  key: string;
  data?: T;
  error: string;
  isLoading: boolean;
}

export interface QueryState<T> {
  data: T | undefined;
  error: string;
  isLoading: boolean;
  /** Yeniden deneme (mutasyon sonrası) */
  refresh: () => void;
  /** Uç nokta/parametre değiştiğinde devam eden eski veriyi temizler. */
  reset: () => void;
}

function describeError(reason: unknown): string {
  if (reason instanceof ApiError) return reason.message;
  if (reason instanceof Error) return reason.message;
  return "Beklenmeyen bir hata oluştu.";
}

function resolvePath(key: readonly unknown[] | null): string | undefined {
  const template = key?.[0];
  if (typeof template !== "string") return undefined;
  const parameters = key?.slice(1) ?? [];

  let parameterIndex = 0;
  return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (placeholder) => {
    const value = parameters[parameterIndex];
    parameterIndex += 1;
    return typeof value === "string" || typeof value === "number"
      ? encodeURIComponent(String(value))
      : placeholder;
  });
}

/**
 * Bağımlılıksız SWR benzeri veri hook'u.
 * Aynı anahtar için istek tekrarını (deduplication) engeller ve eski isteğin
 * sonucunu yarış koşulunda (race condition) yok sayar.
 */
export function useApiQuery<T>(
  key: readonly unknown[] | null,
  options: RequestOptions & { enabled?: boolean; list?: boolean } = {},
): QueryState<T> {
  const { enabled = true, list = false, ...requestOptions } = options;
  const serializedKey = JSON.stringify(key);
  const [snapshot, setSnapshot] = useState<QuerySnapshot<T>>({
    key: serializedKey,
    data: undefined,
    error: "",
    isLoading: enabled,
  });
  const [nonce, setNonce] = useState(0);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef<Map<string, Promise<unknown>>>(new Map());

  const queryString = options.query ? JSON.stringify(options.query) : "";
  const path = resolvePath(key);
  const isActive = enabled && Boolean(path) && !path?.match(/:[A-Za-z][A-Za-z0-9_]*/);
  const stableOptions = useCallback(
    () => ({ ...requestOptions, query: queryString ? JSON.parse(queryString) : undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryString],
  );

  useEffect(() => {
    if (!isActive || typeof path !== "string") return;
    const requestId = ++requestIdRef.current;
    const cacheKey = `${serializedKey}::${nonce}`;

    const existing = inFlightRef.current.get(cacheKey);
    const promise = existing ?? (
      list
        ? requestList<unknown>(path, stableOptions())
        : request<T>(path, stableOptions())
    );
    if (!existing) inFlightRef.current.set(cacheKey, promise);

    promise
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setSnapshot({ key: serializedKey, data: data as T, error: "", isLoading: false });
      })
      .catch((reason: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setSnapshot({ key: serializedKey, data: undefined, error: describeError(reason), isLoading: false });
      })
      .finally(() => {
        inFlightRef.current.delete(cacheKey);
      });

    return () => {
      // Yeni anahtar/parametre için eski yanıtın işlenmesini engelle.
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [serializedKey, nonce, isActive, list, path, stableOptions]);

  /**
   * Anahtar değiştiyse eski veri gösterilmez; yeni istek tamamlanana kadar iskelet görünür.
   * Yenileme (refresh) arka planda çalışır ve mevcut veriyi düşürmez — SWR davranışı.
   */
  const isCurrent = snapshot.key === serializedKey;
  const data = isCurrent ? snapshot.data : undefined;
  const error = isCurrent ? snapshot.error : "";
  const isLoading = isActive && (!isCurrent || snapshot.isLoading);

  return {
    data,
    error,
    isLoading,
    refresh: useCallback(() => setNonce((value) => value + 1), []),
    reset: useCallback(() => setSnapshot({ key: serializedKey, data: undefined, error: "", isLoading: true }), [serializedKey]),
  };
}

/** Yazma işlemleri (POST/PATCH/DELETE) için hata yönetimli yardımcı. */
export function useApiMutation<TIn, TOut>(mutate: (input: TIn) => Promise<TOut>) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const run = useCallback(
    async (input: TIn): Promise<TOut | undefined> => {
      setIsPending(true);
      setError("");
      setIsSuccess(false);
      try {
        const result = await mutate(input);
        setIsSuccess(true);
        return result;
      } catch (reason) {
        setError(describeError(reason));
        return undefined;
      } finally {
        setIsPending(false);
      }
    },
    [mutate],
  );

  return { run, isPending, error, isSuccess, reset: useCallback(() => { setError(""); setIsSuccess(false); }, []) };
}
