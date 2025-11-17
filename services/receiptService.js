import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates subscription receipt PDF
 * Returns PDF buffer and filename
 */
export async function generateSubscriptionReceiptPDF({
    email,
    fullName,
    planName,
    amount,
    transactionId,
    transactionDate
}) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const buffers = [];

            // Image paths
            const kinayuLogo = path.join(__dirname, '..', 'public', 'KINAYU.png');
            const ronnieLogo = path.join(__dirname, '..', 'public', 'RONNIE.png');
            const ronnieStamp = path.join(__dirname, '..', 'public', 'RONNIESSTAMP.png');

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', async () => {
                try {
                    const pdfBuffer = Buffer.concat(buffers);
                    const fileName = `Subscription_Receipt_${moment(transactionDate).format('YYYYMMDDHHmmss')}.pdf`;
                    
                    resolve({
                        pdfBuffer,
                        fileName
                    });
                } catch (error) {
                    reject(error);
                }
            });

            // PDF content generation (keep your existing PDF generation code)
            const drawWatermarks = (document) => {
                const watermarkSize = 60;
                const spacing = 100;
                document.opacity(0.1);
                for (let x = 0; x < document.page.width; x += spacing) {
                    for (let y = 0; y < document.page.height; y += spacing) {
                        document.image(ronnieLogo, x, y, { width: watermarkSize });
                    }
                }
                document.opacity(1);
            };

            drawWatermarks(doc);
            doc.on('pageAdded', () => drawWatermarks(doc));

            // Set up page margins and add logos
            doc.page.margins = { top: 50, bottom: 50, left: 50, right: 50 };
            doc.image(kinayuLogo, 50, 50, { width: 100 });
            doc.image(ronnieLogo, doc.page.width - 150, 50, { width: 100, align: 'right' });

            // Title and legal information
            doc.moveDown(2);
            doc.fontSize(16).font('Helvetica-Bold').text('LICENCE AGREEMENT', { align: 'center' });
            doc.fontSize(12).font('Helvetica-Bold').text('THE REPUBLIC OF UGANDA', { align: 'center' });
            doc.fontSize(10).font('Helvetica-Bold').text('IN THE MATTER OF THE COPYRIGHT AND NEIGHBOURING RIGHTS ACT 2006', { align: 'center' });
            doc.text('AND IN THE MATTER OF THE CONTRACTS ACT 2010', { align: 'center' });

            doc.moveDown(1.5);
            doc.font('Helvetica').fontSize(10).text('This agreement made this ', { continued: true });
            doc.font('Helvetica-Bold').text(`${moment(transactionDate).format('DD')} Day of ${moment(transactionDate).format('MMMM')} ${moment(transactionDate).format('YYYY')}`);
            doc.moveDown();

            doc.font('Helvetica-Bold').text('Holder\'s Name:', { continued: true }).font('Helvetica').text(` ${fullName}`);
            doc.font('Helvetica-Bold').text('Library/Sale Point:', { continued: true }).font('Helvetica').text(` Ronnie's Entertainment SMC Ltd`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text('Movie Titles Purchased:', { continued: true }).font('Helvetica').fontSize(12).text(` ${planName}`);
            doc.moveDown(0.5);

            doc.font('Helvetica-Bold').text('Start Date of Licence:', { continued: true }).font('Helvetica').text(` ${moment(transactionDate).format('DD')} Day of ${moment(transactionDate).format('MMMM')} ${moment(transactionDate).format('YYYY')}`);
            doc.font('Helvetica-Bold').text('Number of Copies:', { continued: true }).font('Helvetica').text(` 1`);
            doc.font('Helvetica-Bold').text('Price per Copy (UGX):', { continued: true }).font('Helvetica').text(` ${amount}`).moveDown(0.5);
            
            doc.font('Helvetica-Bold').fillColor('blue').text('Licence No:', { continued: true }).fillColor('black');
            doc.font('Helvetica-Bold').fillColor('red').text(` ${transactionId}`);
            doc.fillColor('black');

            doc.moveDown(2);

            // A - ACCEPTANCE Section
            doc.fontSize(14).font('Helvetica-Bold').text('A - ACCEPTANCE').moveDown(0.5);
            doc.font('Helvetica').fontSize(12).text('The Holder authorizes the sales person herein to sell Ugandan movies (Ebinayuganda) from ', { continued: true });
            doc.font('Helvetica-Bold').text('KINAYU MOVIES', { continued: true }).font('Helvetica');
            doc.text(' and in particular the movie titles as listed above. The sales person/licensee must live and abide by the terms and conditions listed in this Licence Agreement.').moveDown();

            // B - LICENCE Section
            doc.font('Helvetica-Bold').text('B - LICENCE').moveDown(0.5);
            doc.font('Helvetica').text('The ', { continued: true });
            doc.font('Helvetica-Bold').text('Holder/Licensee', { continued: true }).font('Helvetica');
            doc.text(' will authorize the Sales of only movies with Kinayu movies logo encrypted in it, through duplication of DVDs, CDs, soft copies i.e. flash drives, memory cards, hard discs and phones.').moveDown();

            doc.font('Helvetica-Bold').text('NB:').font('Helvetica').text(' A Security device of collecting society must be attached on DVDs.').moveDown();
            doc.text('This license herein only works in one sell point as herein mentioned, with every sell point acquiring a specific copyright use licence with attached sell point name.').moveDown();

            // C - PROHIBITIONS Section
            doc.font('Helvetica-Bold').text('C - PROHIBITIONS').moveDown(0.5);
            doc.font('Helvetica').text('The Sales person herein is not allowed to deal, transact, upload the licensed movies to internet, digital space or social networks including TikTok, YouTube, Facebook among others, show or screening in public places, Cinematograph Theatres/video halls, cinema halls, Clubs and on TV Stations and other unauthorized windows.').moveDown();
            doc.text('The Sales person is not allowed to edit, add or subtract anything but only the way they are packaged and given to you e.g. don\'t add adverts or any sort of reproduction.').moveDown();
            doc.text('The Sales person is only supposed to vend/sell these movies only to the consumers and not distribute to another seller.').moveDown();

            // D - TERM OF LICENCE Section
            doc.font('Helvetica-Bold').text('D - TERM OF LICENCE').moveDown(0.5);
            doc.font('Helvetica').text('The term/duration of the licence herein shall be from the issuing date listed above and remain effective until ').font('Helvetica-Bold').text('December 31, 2028').font('Helvetica').text('.').moveDown();

            // E - PRICING AND PAYMENTS Section
            doc.font('Helvetica-Bold').text('E - PRICING AND PAYMENTS').moveDown(0.5);
            doc.font('Helvetica').text('The number of copies listed above will be paid as per the stated price per copy in Ugandan Shillings.').moveDown();
            doc.text('This Licence Agreement shall be protected and governed by the laws of Uganda.').moveDown();

            doc.moveDown(2);

            const leftX = 50;
            const rightX = doc.page.width / 2;
            const initialY = doc.y;

            // Left side: Holder details
            doc.font('Helvetica-Bold').text('Holder / Licencer', leftX, initialY);
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').text('Name:', { continued: true }).font('Helvetica').text(` ${fullName}`);
            doc.font('Helvetica-Bold').text('Sign:', { continued: true }).font('Helvetica').text(' '); // Placeholder for signature
            doc.font('Helvetica-Bold').text('Date:', { continued: true }).font('Helvetica').text(` ${moment(transactionDate).format('DD.MM.YYYY')}`);

            // Right side: Sales Person details
            doc.font('Helvetica-Bold').text('Sales Person / Licensee', rightX, initialY);
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').text('Name:', rightX, initialY + 20, { continued: true }).font('Helvetica').text(` Ronnie's Entertainment SMC Ltd`);
            doc.font('Helvetica-Bold').text('Sign:', rightX, initialY + 40, { continued: true }).font('Helvetica').text(''); // Placeholder for signature
            doc.font('Helvetica-Bold').text('Date:', rightX, initialY + 60, { continued: true }).font('Helvetica').text(` ${moment(transactionDate).format('DD.MM.YYYY')}`);
            
            // Place the stamp exactly on top of the signature lines
            doc.image(ronnieStamp, rightX + 15, initialY + 30, { width: 100 });

            doc.end();

        } catch (error) {
            console.error('[Receipt Service] Error creating PDF:', error);
            reject(error);
        }
    });
}