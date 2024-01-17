import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';

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
    MatTableModule,
    MatInputModule,
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

  //#region VARIABLES

  selectedFile: any = null;

  qrColumns = new FormControl(null, [Validators.required]);
  flColumns = new FormControl(null, [Validators.required]);
  slColumns = new FormControl(null, [Validators.required]);

  sourceColumns: string[] = [];
  columns: Column[] = [];

  data: unknown[] = [];

  columnsValid: boolean = false;

  //#endregion

  //#region STEP 1 - FILE

  onFileSelected(event: any): void {
    this.previewDone = false;

    this.selectedFile = event.target.files[0] ?? null;

    if (this.selectedFile) {
      Papa.parse(this.selectedFile, {
        worker: true,
        complete: ({ data }) => {
          const cols: string[] = data[0] as string[];

          this.sourceColumns = cols.map((name: string) => name);
          this.data = data.slice(1);
          this.onLabelEdited();
        },
      });
    }
  }

  //#endregion

  //#region STEP 2 - COLUMNS & FORMAT

  displayedColumns: string[] = ['name', 'type', 'x', 'y', 'height', 'width'];

  label: Label = {
    height: 96,
    width: 200,
    columns: [],
  };

  labelSrc: string = '';

  addColumn(): void {
    this.label.columns = [
      ...this.label.columns,
      {
        name: this.sourceColumns[0],
        type: 'text',
        x: 0,
        y: 0,
        height: 0,
        width: 0,
      },
    ];
  }

  deleteColumn(index: number): void {
    this.label.columns.splice(index, 1);
    this.onLabelEdited();
  }

  async onLabelEdited(): Promise<void> {
    // Generate label
    const canvas = new OffscreenCanvas(this.label.width, this.label.height);

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const columns = [...this.label.columns];

    const processNext = async (): Promise<void> => {
      if (columns.length === 0) {
        // setTimeout(async () => {
          console.log('canvas conv started');
          let blob = await canvas.convertToBlob();
          this.labelSrc = URL.createObjectURL(blob);
          console.log('canvas converted');
          console.log(this.labelSrc);

          this.previewDone = false;
          if (
            this.qrColumns.valid &&
            this.flColumns.valid &&
            this.slColumns.valid
          ) {
            this.columnsValid = true;
          }
        // }, 2000);
        return;
      }

      const col = columns.shift() as Column;

      if (col.type === 'text') {
        let v = (this.data[0] as string[])[
          this.sourceColumns.indexOf(col.name)
        ] as string;
        ctx.font = `${col.height * 0.75}px Arial`;
        ctx.fillStyle = '#000';
        ctx.fillText(v, col.x, col.y + col.height, col.width);

        console.log('text drawn');

        processNext();
      }

      if (col.type === 'img') {
        let v = ('data:image/png;base64, ' +
          (this.data[0] as string[])[
            this.sourceColumns.indexOf(col.name)
          ]) as string;
        const img = new Image();

        img.onload = () => {
          ctx.drawImage(img, col.x, col.y, col.width, col.height);

          console.log('img drawn');

          processNext();
        };
        img.src = v;
      }

      if (col.type === 'qr') {
        let v = (this.data[0] as string[])[
          this.sourceColumns.indexOf(col.name)
        ] as string;
        QRCode.toDataURL(v, (err, url) => {
          const img = new Image();

          console.log('url : ', url);

          img.onload = () => {
            ctx.drawImage(img, col.x, col.y, col.width, col.height);

            console.log('qr drawn');

            processNext();
          };
          img.src = url;
        });
      }
    };

    processNext();
  }

  //#endregion

  //#region STEP 3 - PREVIEW

  previewDone: boolean = false;

  offCanvas = new OffscreenCanvas(10, 10);
  offCtx = this.offCanvas.getContext('2d');

  previewSrc: string = '';

  onPreviewClick(): void {
    const fr = this.data[0] as string[];

    const qrIndex = this.qrColumns.value as unknown as number;
    const flIndex = this.flColumns.value as unknown as number;
    const slIndex = this.slColumns.value as unknown as number;

    const [qr, ref, nom] = [fr[qrIndex], fr[flIndex], fr[slIndex]];

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
        this.previewSrc = URL.createObjectURL(blob);

        // Done
        this.previewDone = true;
      };

      img.src = url;
    });
  }

  //#endregion

  //#region STEP 4 - DOWNLOAD

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

  //#endregion
}
