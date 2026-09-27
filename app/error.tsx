"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SystemPage } from "./ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <SystemPage title="화면을 불러오지 못했습니다" description="일시적인 오류일 수 있습니다. 다시 시도하거나 지역현황으로 이동해 주세요."><button className="primary-button" type="button" onClick={reset}>다시 시도</button><Link className="secondary-button" href="/">지역현황으로 이동</Link></SystemPage>;
}
