const PARTY_ARMY_COLORS = ["#ff0000", "#ff00ff", "#00bbff", "#00ff00"];
const PARTY_BORDER_RGB = [
  "255, 0, 0",
  "255, 0, 255",
  "0, 187, 255",
  "0, 255, 0"
];
const NEIGHBOR_EDGE_MAP = [3, 2, 1, 0, 5, 4];

/** Iterate every hex field on the board. */
function forEachField(board, callback) {
  for (let x = 0; x < board.hw_xmax; x++) {
    for (let y = 0; y < board.hw_ymax; y++) {
      callback(board.field[`f${x}x${y}`], x, y);
    }
  }
}

class MapRender {
  drawInitialBackground(board) {
    const canvas = document.getElementById('map');
    if (!canvas) return;
    canvas.getContext('2d').drawImage(board.background_2, 0, 0);
  }

  drawMap(board, images) {
    const canvas = document.getElementById('map');
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const offsetX = board.renderOffset?.x || 0;
    const offsetY = board.renderOffset?.y || 0;
    ctx.save();
    ctx.translate(offsetX, offsetY);

    ctx.drawImage(board.background_2, 0, 0);
    ctx.drawImage(board.background_sea, 0, 0);

    forEachField(board, (field) => {
      const { _x: xCenter, _y: yCenter } = field;
      this.drawHexOutline(ctx, xCenter, yCenter);
      this.drawEstate(ctx, field, images, xCenter, yCenter);
      this.drawArmy(ctx, field, xCenter, yCenter);
    });

    this.drawTerritoryBorders(ctx, board);
    this.drawTownNames(ctx, board);
    ctx.restore();
  }

  drawEstate(ctx, field, images, xCenter, yCenter) {
    if (field.estate === "town") {
      const cityImg = field.capital >= 0
        ? images[`capital${field.capital}`].img
        : images.city.img;
      const options = field.army
        ? { scale: 0.9, offsetX: 17, offsetY: -5 }
        : undefined;
      this.drawCenteredImage(ctx, cityImg, xCenter, yCenter, options);
      return;
    }

    if (field.estate !== "port") return;

    const options = field.army
      ? { scale: 0.5, offsetX: 25, offsetY: -5 }
      : undefined;
    this.drawCenteredImage(ctx, images.port.img, xCenter, yCenter, options);
  }

  drawArmy(ctx, field, xCenter, yCenter) {
    if (!field.army) return;

    const party = field.army.party >= 0 ? field.army.party : 0;
    const color = field.army.party >= 0 ? PARTY_ARMY_COLORS[party] : "#000000";
    const { count, morale } = field.army;

    this.drawCircle(ctx, xCenter, yCenter, 17, "#ffffff", color);
    this.drawTextWithBackground(ctx, `${count}/${morale}`, xCenter, yCenter + 1, {
      padding: 5,
      cornerRadius: 3,
      bgColor: 'rgba(0, 0, 0, 0.7)',
      textColor: '#ffffff'
    });
  }

  drawTownNames(ctx, board) {
    forEachField(board, (field) => {
      if (field.estate !== "town" && field.estate !== "port") return;

      const textHeight = 13;
      const textY = field._y - 30 + textHeight / 2;

      this.drawTextWithBackground(ctx, field.town_name, field._x, textY, {
        padding: 6,
        cornerRadius: 4,
        bgColor: 'rgba(0, 0, 0, 0.75)',
        textColor: '#ffffff',
        shadow: true,
        shadowOffsetX: 1,
        shadowOffsetY: 2,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
      });
    });
  }

  drawCenteredImage(ctx, image, xCenter, yCenter, options = {}) {
    const {
      scale = 1.0,
      offsetX = 0,
      offsetY = 0
    } = options;

    const width = image.width;
    const height = image.height;
    const baseX = xCenter - (width / 2);
    const baseY = yCenter - (height / 2);

    if (scale === 1.0 && offsetX === 0 && offsetY === 0) {
      ctx.drawImage(image, baseX, baseY);
      return;
    }

    ctx.save();
    ctx.translate(baseX + offsetX, baseY + offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  getHexVertices(xCenter, yCenter, size = 25) {
    const halfWidth = size / 2;
    const height = size * 0.8;

    return [
      { x: xCenter - halfWidth, y: yCenter - height },
      { x: xCenter - size, y: yCenter },
      { x: xCenter - halfWidth, y: yCenter + height },
      { x: xCenter + halfWidth, y: yCenter + height },
      { x: xCenter + size, y: yCenter },
      { x: xCenter + halfWidth, y: yCenter - height }
    ];
  }

  drawHexOutline(ctx, xCenter, yCenter) {
    const vertices = this.getHexVertices(xCenter, yCenter, 24);

    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.strokeStyle = "rgba(255, 255, 102, 0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.closePath();
  }

  drawTerritoryBorderEdge(ctx, vStart, vEnd, xCenter, yCenter, rgb, alphaStart, alphaLine) {
    const midX = (vStart.x + vEnd.x) / 2;
    const midY = (vStart.y + vEnd.y) / 2;

    const gradient = ctx.createLinearGradient(midX, midY, xCenter, yCenter);
    gradient.addColorStop(0, `rgba(${rgb}, ${alphaStart})`);
    gradient.addColorStop(0.5, `rgba(${rgb}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(xCenter, yCenter);
    ctx.lineTo(vStart.x, vStart.y);
    ctx.lineTo(vEnd.x, vEnd.y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(vStart.x, vStart.y);
    ctx.lineTo(vEnd.x, vEnd.y);
    ctx.strokeStyle = `rgba(${rgb}, ${alphaLine})`;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  drawTerritoryBorders(ctx, board) {
    forEachField(board, (field) => {
      if (field.party === -1 || !field.neighbours) return;

      const { _x: xCenter, _y: yCenter, party } = field;
      const vertices = this.getHexVertices(xCenter, yCenter, 25);
      const rgb = party >= 0 && party < 4 ? PARTY_BORDER_RGB[party] : "0, 0, 0";
      const isHumanTerritory = party === board.human;
      const alphaStart = isHumanTerritory ? 0.8 : 0.6;
      const alphaLine = isHumanTerritory ? 1.0 : 0.8;

      for (let i = 0; i < 6; i++) {
        const neighbor = field.neighbours[i];
        if (neighbor && neighbor.party === party) continue;

        const edgeIndex = NEIGHBOR_EDGE_MAP[i];
        this.drawTerritoryBorderEdge(
          ctx,
          vertices[edgeIndex],
          vertices[(edgeIndex + 1) % 6],
          xCenter,
          yCenter,
          rgb,
          alphaStart,
          alphaLine
        );
      }
    });
  }

  drawCircle(ctx, xCenter, yCenter, radius, fillColor, outlineColor) {
    ctx.beginPath();
    ctx.arc(xCenter, yCenter, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
  }

  drawRoundedRectangle(ctx, x, y, width, height, cornerRadius, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
    ctx.closePath();
    ctx.fill();
  }

  drawTextWithBackground(ctx, text, xCenter, yCenter, options = {}) {
    const {
      font = 'bold 11px "Segoe UI", Arial, sans-serif',
      padding = 5,
      cornerRadius = 3,
      bgColor = 'rgba(0, 0, 0, 0.7)',
      textColor = '#ffffff',
      textAlign = 'center',
      textBaseline = 'middle',
      shadow = false,
      shadowOffsetX = 1,
      shadowOffsetY = 2,
      shadowColor = 'rgba(0, 0, 0, 0.3)'
    } = options;

    ctx.font = font;
    const textWidth = ctx.measureText(text).width;
    const textHeight = 13;

    const bgX = xCenter - textWidth / 2 - padding;
    const bgY = yCenter - textHeight / 2;
    const bgWidth = textWidth + padding * 2;

    this.drawRoundedRectangle(ctx, bgX, bgY, bgWidth, textHeight, cornerRadius, bgColor);

    if (shadow) {
      ctx.fillStyle = shadowColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, bgX + padding + shadowOffsetX, yCenter + shadowOffsetY);
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, xCenter, yCenter);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

export { MapRender }
