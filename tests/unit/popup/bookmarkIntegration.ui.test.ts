/** @jest-environment jsdom */
import browser from 'webextension-polyfill';

// Legacy DOM-based popup test; skipping while React popup is being introduced
describe.skip('Popup Bookmark Integration UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    (browser.runtime.sendMessage as jest.Mock).mockReset();
    (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 99, index: 1, url: 'https://example.com?silo=work', cookieStoreId: 'firefox-default' }]);
  });

  it('processes URL and enables open button', async () => {
    (browser.runtime.sendMessage as jest.Mock).mockImplementation(async (msg: any) => {
      if (msg.type === 'PING') {
        return { success: true, data: 'PONG' };
      }
      if (msg.type === 'PROCESS_BOOKMARK_URL') {
        return { success: true, data: { cleanUrl: 'https://example.com', containerId: 'firefox-container-1' } };
      }
      if (msg.type === 'OPEN_IN_CONTAINER') {
        return { success: true, data: { tabId: 123 } };
      }
      return { success: true };
    });

    // Dynamically import the popup script (it attaches DOMContentLoaded listener)
    await import('../../../src/popup/index');

    // Trigger DOMContentLoaded to bootstrap UI
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Wait until active tab URL is reflected (ensures listeners are attached)
    await waitFor(() => {
      expect((document.getElementById('currentUrl') as HTMLSpanElement).textContent).toBe('https://example.com?silo=work');
    });

    // Click process button
    const processBtn = document.getElementById('processBtn')!;
    processBtn.dispatchEvent(new MouseEvent('click'));

    // Verify process message sent and button enabled
    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'PROCESS_BOOKMARK_URL',
        payload: expect.objectContaining({ url: 'https://example.com?silo=work' })
      }));
      const openBtn = document.getElementById('openBtn') as HTMLButtonElement;
      expect(openBtn.disabled).toBe(false);
    });

    // Click open button
    openBtn.click();

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'OPEN_IN_CONTAINER',
      payload: expect.objectContaining({ url: 'https://example.com', cookieStoreId: 'firefox-container-1' })
    }));
  });

  it('creates a bookmark for the current tab in its container', async () => {
    (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 99, index: 1, url: 'https://example.com/page', cookieStoreId: 'firefox-container-1', title: 'Example Page' }]);
    (browser.bookmarks.create as jest.Mock).mockResolvedValue({ id: 'b1' });
    (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({ success: true, data: 'PONG' });

    await import('../../../src/popup/index');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const createBookmarkBtn = await waitFor(() => document.getElementById('createBookmarkBtn'));
    (browser.bookmarks.create as jest.Mock).mockClear();
    (createBookmarkBtn as HTMLButtonElement).click();

    await waitFor(() => {
      expect(browser.bookmarks.create).toHaveBeenCalled();
    });
  });
});

// Simple utility similar to RTL waitFor to avoid bringing in testing-library for now
function waitFor<T>(fn: () => T, { timeout = 2000, interval = 10 } = {}): Promise<T> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const val = fn();
        resolve(val);
      } catch (e) {
        if (Date.now() - start > timeout) {
          reject(e);
        } else {
          setTimeout(tick, interval);
        }
      }
    };
    tick();
  });
}


