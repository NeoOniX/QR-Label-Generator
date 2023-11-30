import "./App.css";
import React from "react";
import { useState, useEffect, createRef } from "react";
import Papa from "papaparse";
import QRCode from "qrcode";
import JSZip from "jszip";

const offCanvas = new OffscreenCanvas(10, 10);
const offCtx = offCanvas.getContext("2d");

const App = () => {
  const previewElmt = createRef();

  const [step, setStep] = useState(0);

  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);

  const [qrIndex, setQRIndex] = useState(-1);
  const [flIndex, setFlIndex] = useState(-1);
  const [slIndex, setSlIndex] = useState(-1);

  const handleFileChange = (e) => {
    if (e.target.files) {
      try {
        const file = e.target.files[0];

        Papa.parse(file, {
          worker: true,
          complete({ data }) {
            setData(data);
            setHeaders(data[0]);
            setStep(1);
          },
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      setStep(0);
    }
  };

  useEffect(() => {
    if (qrIndex !== -1 && flIndex !== -1 && slIndex !== -1) {
      setStep(2);
    } else {
      if (step === 2) {
        setStep(1);
      }
    }
  }, [qrIndex, flIndex, slIndex]);

  const handleQRChange = (e) => {
    if (e.target.value === "0") {
      setQRIndex(-1);
    } else {
      setQRIndex(headers.indexOf(e.target.value));
    }
  };

  const handleFlChange = (e) => {
    if (e.target.value === "0") {
      setFlIndex(-1);
    } else {
      setFlIndex(headers.indexOf(e.target.value));
    }
  };

  const handleSlChange = (e) => {
    if (e.target.value === "0") {
      setSlIndex(-1);
    } else {
      setSlIndex(headers.indexOf(e.target.value));
    }
  };

  const handlePreviewClick = () => {
    const [qr, ref, nom] = [
      data[1][qrIndex],
      data[1][flIndex],
      data[1][slIndex],
    ];

    QRCode.toDataURL(qr, (err, url) => {
      // Transform to image
      const img = new Image();

      img.onload = async () => {
        // Check size
        offCtx.font = "30px Arial";
        const ml = Math.max(
          offCtx.measureText(ref).width,
          offCtx.measureText(nom).width
        );

        // Get height and width
        const [h, w] = [96, 106 + ml];

        // Generate sticker
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, -10, -10, 116, 116);
        ctx.font = "30px Arial";
        ctx.fillStyle = "#000";
        ctx.fillText(ref, 106, h / 3 + 5, canvas.width - 136);
        ctx.fillText(nom, 106, 2 * (h / 3) + 15, canvas.width - 136);

        // Draw preview
        let blob = await canvas.convertToBlob();
        previewElmt.current.src = URL.createObjectURL(blob);

        // Set Preview Size
        previewElmt.current.style.display = "block";

        // Display "Generate" button
        setStep(3);
      };

      img.src = url;
    });
  };

  const handleGenerateClick = () => {
    const zip = new JSZip();

    let c = 0;

    data.slice(1).forEach((line, i) => {
      const [qr, ref, nom] = [line[qrIndex], line[flIndex], line[slIndex]];

      QRCode.toDataURL(qr, (err, url) => {
        // Transform to image
        const img = new Image();

        img.onload = async () => {
          // Check size
          offCtx.font = "30px Arial";
          const ml = Math.max(
            offCtx.measureText(ref).width,
            offCtx.measureText(nom).width
          );

          // Get height and width
          const [h, w] = [96, 106 + ml];

          // Generate sticker
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, -10, -10, 116, 116);
          ctx.font = "30px Arial";
          ctx.fillStyle = "#000";
          ctx.fillText(ref, 106, h / 3 + 5, canvas.width - 136);
          ctx.fillText(nom, 106, 2 * (h / 3) + 15, canvas.width - 136);

          // Save ZIP
          zip.file(`image-${i}.png`, await canvas.convertToBlob(), {
            base64: true,
          });

          // Download if count
          c++;
          if (c === data.length - 2) {
            zip
              .generateAsync({
                type: "blob",
                streamFiles: true,
              })
              .then((zipData) => {
                const ln = document.createElement("a");
                ln.href = window.URL.createObjectURL(zipData);
                ln.download = "QR.zip";
                ln.click();
              });
          }
        };

        img.src = url;
      });
    });
  };

  return (
    <div className="container">
      <div className="window">
        <h1>Générateur d'étiquette avec QR Code</h1>
        <div className="step">
          <h2>Étape 1 - Choix du fichier</h2>
          <input
            type="file"
            name="file"
            id="file"
            accept=".csv"
            onChange={handleFileChange}
          />
        </div>
        {step > 0 && (
          <div className="step">
            <h2>Étape 2 - Choix des colonnes</h2>
            <div className="column_selector">
              <label htmlFor="qr">QR Code :</label>
              <select name="qr" id="qr" onChange={handleQRChange}>
                <option value="0">Choisir une colonne</option>
                {headers.map((header) => (
                  <option value={header} key={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
            <div className="column_selector">
              <label htmlFor="fl">
                1<sup>ère</sup> ligne :
              </label>
              <select name="fl" id="fl" onChange={handleFlChange}>
                <option value="0">Choisir une colonne</option>
                {headers.map((header) => (
                  <option value={header} key={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
            <div className="column_selector">
              <label htmlFor="sl">
                2<sup>nde</sup> ligne :
              </label>
              <select name="sl" id="sl" onChange={handleSlChange}>
                <option value="0">Choisir une colonne</option>
                {headers.map((header) => (
                  <option value={header} key={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {step > 1 && (
          <div className="step">
            <h2>Étape 3 - Prévisualisation</h2>
            <button onClick={handlePreviewClick}>Prévisualiser</button>
            <img id="preview" alt="preview" ref={previewElmt} />
          </div>
        )}
        {step > 2 && (
          <div className="step">
            <h2>Étape 4 - Génération</h2>
            <button onClick={handleGenerateClick}>Générer</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
