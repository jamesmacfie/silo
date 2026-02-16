import type { Bookmark } from "@/shared/types"
import {
  exportToChromeFormat,
  exportToNetscapeFormat,
  parseChromeFormat,
  parseNetscapeFormat,
} from "@/shared/utils/bookmarkFormats"

describe("bookmarkFormats", () => {
  const bookmarks: Bookmark[] = [
    {
      id: "toolbar_____",
      title: "Bookmarks Toolbar",
      type: "folder",
      index: 0,
      children: [
        {
          id: "1",
          title: "Example",
          url: "https://example.com",
          type: "bookmark",
          index: 0,
        },
      ],
    },
  ]

  it("exports bookmarks to netscape HTML format", () => {
    const result = exportToNetscapeFormat(bookmarks)

    expect(result.html).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>")
    expect(result.html).toContain("https://example.com")
    expect(result.html).toContain("Example")
  })

  it("parses netscape HTML format", () => {
    const parsed = parseNetscapeFormat(`
      <DL><p>
        <DT><H3>Folder</H3>
        <DL><p>
          <DT><A HREF="https://example.com">Example</A>
        </DL><p>
      </DL><p>
    `)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual(
      expect.objectContaining({
        title: "Folder",
        type: "folder",
      }),
    )
    expect(parsed[0].children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Example",
          type: "bookmark",
          url: "https://example.com",
        }),
      ]),
    )
  })

  it("round-trips chrome format conversion", () => {
    const chrome = exportToChromeFormat(bookmarks)
    const parsed = parseChromeFormat(chrome)

    expect(chrome.version).toBe(1)
    expect(parsed[0].type).toBe("folder")
    expect(parsed[0].title).toBe("Bookmarks Toolbar")
  })
})
