import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { Wallet, verifyMessage, parseEther, formatEther } from 'ethers';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';
import { associatedTokenAddress } from '../src/services/SolanaTokenAdapter.js';
import { z } from 'zod';

test('ExcelJS survives uuid upgrade and preserves exact workbook values', async () => {
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Verified source');
 sheet.addRow(['Parcel','Amount cents']);sheet.addRow(['001-000-001',195070522]);
 const bytes=await book.xlsx.writeBuffer();const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(bytes);
 assert.equal(reopened.worksheets[0].getCell('A2').value,'001-000-001');assert.equal(reopened.worksheets[0].getCell('B2').value,195070522);
});
test('Replacement Ethereum library signs and verifies offline without moving money', async () => {
 const signer=Wallet.createRandom();const signature=await signer.signMessage('Synthetic offline dependency check');
 assert.equal(verifyMessage('Synthetic offline dependency check',signature),signer.address);
 assert.equal(formatEther(parseEther('0.000000000000000001')),'0.000000000000000001');
});
test('Solana async keys and official token instructions work offline', async () => {
 const payer=await Keypair.generate();const restored=await Keypair.fromSecretKey(payer.secretKey);
 assert.equal(restored.publicKey.toBase58(),payer.publicKey.toBase58());
 const mint=(await Keypair.generate()).publicKey;const ata=await associatedTokenAddress(mint,payer.publicKey);
 assert.ok(ata instanceof PublicKey);
 const instruction=getCreateAssociatedTokenIdempotentInstruction({payer,ata,owner:payer.publicKey,mint});
 const transaction=new Transaction().add(instruction);assert.equal(transaction.instructions.length,1);
});
test('Zod4 record and prefault retain nested configuration defaults', () => {
 const schema=z.object({config:z.object({enabled:z.boolean().default(false)}).prefault({}),values:z.record(z.string(),z.number())});
 assert.deepEqual(schema.parse({values:{source:41}}),{config:{enabled:false},values:{source:41}});
 assert.equal(schema.safeParse({values:{source:'fake'}}).success,false);
});
test('Unqualified NFT operations cannot fabricate chain receipts or claim rights', async () => {
 const {nftService}=await import('../src/services/NFTService.js');
 assert.equal((await nftService.mintClaimNFT({claimId:'synthetic',amount:1,state:'TN',propertyId:'synthetic',ownerAddress:'synthetic',clientName:'Synthetic only'})).success,false);
 assert.equal((await nftService.transferNFT('synthetic','synthetic','synthetic')).success,false);
 assert.equal((await nftService.burnNFT('synthetic')).success,false);
 await assert.rejects(nftService.listMintedNFTs());await assert.rejects(nftService.getNFTDetails('synthetic'));
});
test('MJML5 rendering is awaited, escaped, application-bound, and never pretends mail was sent', async () => {
 for(const key of Object.keys(process.env))if(/^(SMTP_|MODOBOA_|BREVO_|SES_)/.test(key))delete process.env[key];
 process.env.CAPITAL_EMAIL_ALLOW_EXTERNAL_FALLBACKS='false';process.env.FRONTEND_URL='https://capitalmgr.com';
 const {emailService}=await import('../src/services/EmailService.js');
 // Inspect actual compiled output without sending or injecting a replacement renderer.
 const render=(emailService as unknown as {renderTemplate:(name:string,data:Record<string,unknown>)=>Promise<string>}).renderTemplate.bind(emailService);
 const html=await render('welcome',{name:'<script>bad()</script>',loginUrl:'/auth/login'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad()'));
 assert.ok(html.includes('https://capitalmgr.com/auth/login'));
 const {default:htmlnano}=await import('htmlnano');
 const minimized=await htmlnano.process('<html><head><style>.source { color: #ffffff; padding: 0px 0px 0px 0px; }</style></head><body>Verified source</body></html>',{minifyJs:false,minifySvg:false});
 assert.ok(minimized.html.includes('Verified source'));assert.ok(minimized.html.includes('#fff'));assert.ok(!minimized.html.includes('0px 0px 0px 0px'));
 await assert.rejects(render('welcome',{loginUrl:'https://unrelated.example.invalid'}));
 assert.equal(await emailService.sendRaw('synthetic@example.invalid','Dependency test','No provider configured'),false);
 assert.equal(emailService.getStatus().configured,false);
});
