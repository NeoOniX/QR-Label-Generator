import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import Papa from 'papaparse';
import QRCode from 'qrcode';
import JSZip from 'jszip';

@Component({
  selector: 'app-generator',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatStepperModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    ReactiveFormsModule,
    MatDividerModule,
  ],
  templateUrl: './generator.component.html',
  styleUrl: './generator.component.scss',
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: { displayDefaultIndicatorType: false },
    },
  ],
})
export class GeneratorComponent {
  constructor() {}

  // STEP 1 - FILE

  selectedFile: any = null;

  qrColumns = new FormControl(null, [Validators.required]);
  flColumns = new FormControl(null, [Validators.required]);
  slColumns = new FormControl(null, [Validators.required]);

  columns: Column[] = [];

  data: unknown[] = [];

  columnsValid: boolean = false;

  onFileSelected(event: any): void {
    this.previewDone = false;

    this.selectedFile = event.target.files[0] ?? null;

    if (this.selectedFile) {
      Papa.parse(this.selectedFile, {
        worker: true,
        complete: ({ data }) => {
          const cols: string[] = data[0] as string[];

          this.columns = cols.map((name: string) => ({ name }));
          this.data = data.slice(1);
        },
      });
    }
  }

  // STEP 2 - COLUMNS

  onColumnsSubmit(): void {
    this.previewDone = false;
    if (this.qrColumns.valid && this.flColumns.valid && this.slColumns.valid) {
      this.columnsValid = true;
    }
  }

  // STEP 3 - PREVIEW

  previewDone: boolean = false;

  offCanvas = new OffscreenCanvas(10, 10);
  offCtx = this.offCanvas.getContext('2d');

  src: string = '';

  onPreviewClick(): void {
    const fr = this.data[0] as string[];

    const qrIndex = (this.qrColumns.value as unknown) as number;
    const flIndex = (this.flColumns.value as unknown) as number;
    const slIndex = (this.slColumns.value as unknown) as number;

    const [qr, ref, nom] = [
      fr[qrIndex],
      fr[flIndex],
      fr[slIndex],
    ];

    QRCode.toDataURL(qr, (err, url) => {
      // Transform to image
      const img = new Image();

      img.onload = async () => {
        if (!this.offCtx) return;

        // Check size
        this.offCtx.font = '30px Arial';
        const ml = Math.max(
          this.offCtx.measureText(ref).width,
          this.offCtx.measureText(nom).width
        );

        // Get height and width
        const [h, w] = [96, 106 + ml];

        // Generate sticker
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, -10, -10, 116, 116);
        ctx.font = '30px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText(ref, 106, h / 3 + 5, canvas.width - 136);
        ctx.fillText(nom, 106, 2 * (h / 3) + 15, canvas.width - 136);

        // Draw preview
        let blob = await canvas.convertToBlob();
        this.src = URL.createObjectURL(blob);

        // Done
        this.previewDone = true;
      };

      img.src = url;
    });
  }

  // STEP 4 - DOWNLOAD
  download(): void {
    const zip = new JSZip();

    const qrIndex = this.qrColumns.value as unknown as number;
    const flIndex = this.flColumns.value as unknown as number;
    const slIndex = this.slColumns.value as unknown as number;

    let c = 0;

    this.data.forEach((r, i) => {
      const line = r as string[];
      const [qr, ref, nom] = [line[qrIndex], line[flIndex], line[slIndex]];

      QRCode.toDataURL(qr, (err, url) => {
        // Transform to image
        const img = new Image();

        img.onload = async () => {
          if (!this.offCtx) return;

          // Check size
          this.offCtx.font = '30px Arial';
          const ml = Math.max(
            this.offCtx.measureText(ref).width,
            this.offCtx.measureText(nom).width
          );

          // Get height and width
          const [h, w] = [96, 106 + ml];

          // Generate sticker
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext('2d');

          if (!ctx) return;

          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, -10, -10, 116, 116);
          ctx.font = '30px Arial';
          ctx.fillStyle = '#000';
          ctx.fillText(ref, 106, h / 3 + 5, canvas.width - 136);
          ctx.fillText(nom, 106, 2 * (h / 3) + 15, canvas.width - 136);

          // Save ZIP
          zip.file(`image-${i}.png`, await canvas.convertToBlob(), {
            base64: true,
          });

          // Download if count
          c++;
          if (c === this.data.length - 1) {
            zip
              .generateAsync({
                type: 'blob',
                streamFiles: true,
              })
              .then((zipData) => {
                const ln = document.createElement('a');
                ln.href = window.URL.createObjectURL(zipData);
                ln.download = 'QR.zip';
                ln.click();
              });
          }
        };

        img.src = url;
      });
    });
  }
}
