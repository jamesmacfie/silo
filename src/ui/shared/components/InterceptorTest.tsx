import React from "react"
import browser from "webextension-polyfill"

export function InterceptorTest(): JSX.Element {
  const [testUrl, setTestUrl] = React.useState("https://github.com")
  const [testResult, setTestResult] = React.useState<string>("")

  const testInterceptor = React.useCallback(async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: "TEST_INTERCEPTOR",
        payload: { url: testUrl },
      })
      setTestResult(JSON.stringify(response, null, 2))
    } catch (error) {
      setTestResult(`Error: ${error}`)
    }
  }, [testUrl])

  return (
    <div className="mt-8 p-4 border border-gray-300 rounded">
      <h3>Interceptor Test</h3>
      <div className="mb-4">
        <input
          type="text"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          placeholder="Enter URL to test"
          className="w-80 mr-2.5"
        />
        <button type="button" onClick={testInterceptor}>
          Test Rules Engine
        </button>
      </div>
      {testResult && (
        <pre className="bg-gray-100 p-4 text-xs overflow-auto">
          {testResult}
        </pre>
      )}
    </div>
  )
}
