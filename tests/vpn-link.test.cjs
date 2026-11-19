const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {}, AmneziaApp: class {}, TextEncoder, btoa };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../web-ui/static/js/modals.js'), 'utf8'), context);

test('vpn link decodes byte-for-byte to the full UTF-8 AWG 3.1 config', () => {
    const conf = '# Клиент 🛜\n[Interface]\nPrivateKey = test\nAddress = 10.77.0.2/32\nDNS = 10.77.0.1\nHeaderProtectionKey = test-key\nRandomTrailers = on\nDisableCookies = off\nI1 = <b 0xff><r 20>\n[Peer]\nPublicKey = server-key\nEndpoint = example.com:50710\nAllowedIPs = 0.0.0.0/0\n';
    const link = context.window.ModalUi.vpnLink(conf);
    assert.match(link, /^vpn:\/\/[A-Za-z0-9_-]+$/);
    assert.equal(Buffer.from(link.slice(6), 'base64url').toString('utf8'), conf);
});

test('row copy action fetches the selected client and copies its clean config as a link', async () => {
    const conf = '[Interface]\nPrivateKey = test\n[Peer]\nPublicKey = test\n';
    const app = new context.AmneziaApp();
    app.getJson = async (url) => {
        assert.equal(url, '/api/servers/server1/clients/client2/config-both');
        return { clean_config: conf, full_config: 'wrong config' };
    };
    let copied;
    app.copyText = async (value) => { copied = value; return true; };
    let issued = false;
    app.markConfigIssued = async (sid, cid) => {
        assert.equal(sid, 'server1'); assert.equal(cid, 'client2'); issued = true;
    };
    app.showTempMessage = () => assert.fail('unexpected error');
    await app.copyClientVpnLink('server1', 'client2');
    assert.equal(Buffer.from(copied.slice(6), 'base64url').toString('utf8'), conf);
    assert.equal(issued, true);
});

test('clipboard denial does not mark a new config as issued', async () => {
    const app = new context.AmneziaApp();
    app.getJson = async () => ({ clean_config: '[Interface]\n[Peer]' });
    app.copyText = async () => false;
    app.markConfigIssued = () => assert.fail('denied copy must not clear Re-import');
    app.showTempMessage = () => assert.fail('unexpected fetch error');
    await app.copyClientVpnLink('server1', 'client2');
});
