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

  backgroundFile: any = null;
  backgroundImage = new Image();

  qrColumns = new FormControl(null, [Validators.required]);
  flColumns = new FormControl(null, [Validators.required]);
  slColumns = new FormControl(null, [Validators.required]);

  sourceColumns: string[] = [];
  columns: Column[] = [];

  data: unknown[] = [];

  customValid: boolean = false;

  //#endregion

  //#region STEP 1 - FILE

  onFileSelected(event: any): void {
    this.customValid = false;

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

  onBackgroundSelected(event: any): void {
    console.log("On BG selected");
    this.backgroundFile = event.target.files[0] ?? null;

    if (this.backgroundFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.backgroundImage.src = e.target?.result as string;
      };
      reader.readAsDataURL(this.backgroundFile);
    }
  }

  onBackgroundRemoved(): void {
    this.backgroundFile = null;
  }

  //#endregion

  //#region STEP 2 - COLUMNS - FORMAT - PREVIEW

  displayedColumns: string[] = [
    'name',
    'type',
    'x',
    'y',
    'height',
    'width',
    'delete',
  ];

  label: Label = {
    height: 300,
    width: 800,
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

  deleteColumn(column: Column): void {
    this.label.columns = this.label.columns.filter((c) => c !== column);
    this.onLabelEdited();
  }

  onLabelEdited(): void {
    this.generate(this.data[0] as string[], (blob) => {
      this.labelSrc = URL.createObjectURL(blob);
      this.customValid = true;
    });
  }

  //#endregion

  //#region STEP 3 - DOWNLOAD

  download(): void {
    const zip = new JSZip();

    let c = 0;

    let ldata = [...this.data] as string[][];

    for (const data of ldata) {
      this.generate(data, (blob) => {
        console.log(blob);
        // Save ZIP
        zip.file(`image-${c}.png`, blob, {
          base64: true,
        });
        // Download if count
        c++;
        console.log('c : ', c);
        if (c === ldata.length - 1) {
          console.log('download');
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
      });
    }
  }

  //#endregion

  //#region GENERATION

  generate(data: string[], callback: (blob: Blob) => void): void {
    // Generate label
    const canvas = new OffscreenCanvas(this.label.width, this.label.height);

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const columns = [...this.label.columns];

    if (this.backgroundFile)
      ctx.drawImage(this.backgroundImage, 0, 0, canvas.width, canvas.height);

    const processNext = (callback: (blob: Blob) => void): void => {
      if (columns.length === 0) {
        canvas.convertToBlob().then(callback);
        return;
      }

      const col = columns.shift() as Column;

      if (col.type === 'text') {
        if (!data[this.sourceColumns.indexOf(col.name)]) {
          return processNext(callback);
        }

        let v = data[this.sourceColumns.indexOf(col.name)] as string;
        ctx.font = `${col.height * 0.75}px Arial`;
        ctx.fillStyle = '#000';
        ctx.fillText(v, col.x, col.y + col.height, col.width);

        processNext(callback);
      }

      if (col.type === 'img') {
        if (!data[this.sourceColumns.indexOf(col.name)]) {
          return processNext(callback);
        }

        let v = ('data:image/png;base64, ' +
          data[this.sourceColumns.indexOf(col.name)]) as string;
        const img = new Image();

        img.onload = () => {
          ctx.drawImage(img, col.x, col.y, col.width, col.height);

          return processNext(callback);
        };
        img.src = v;
      }

      if (col.type === 'qr') {
        if (!data[this.sourceColumns.indexOf(col.name)]) {
          return processNext(callback);
        }

        let v = data[this.sourceColumns.indexOf(col.name)] as string;
        QRCode.toDataURL(v, (err, url) => {
          const img = new Image();

          img.onload = () => {
            ctx.drawImage(img, col.x, col.y, col.width, col.height);

            return processNext(callback);
          };
          img.src = url;
        });
      }
    };

    processNext(callback);
  }

  //#endregion
}
