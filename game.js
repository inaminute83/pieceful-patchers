document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const scoreDisplay = document.getElementById('score');
    const bestScoreDisplay = document.getElementById('best-score');
    const newGameBtn = document.getElementById('new-game');
    const gameOverElement = document.querySelector('.game-over');
    const gameWonElement = document.querySelector('.game-won');
    const tryAgainBtn = gameOverElement.querySelector('button');
    const keepPlayingBtn = document.querySelector('.keep-playing');
    const newGameWinBtn = document.querySelector('.game-won .new-game');

    let grid = [];
    let score = 0;
    let bestScore = localStorage.getItem('bestScore') || 0;
    let gameOver = false;
    let gameWon = false;
    let canMove = true;
    const GRID_SIZE = 4;

    // Initialize the game
    function initGame() {
        // Clear the grid
        gridContainer.innerHTML = '';
        grid = [];
        score = 0;
        gameOver = false;
        gameWon = false;
        canMove = true;
        
        // Update the score display
        updateScore(0);
        
        // Hide game over and win messages
        gameOverElement.style.display = 'none';
        gameWonElement.style.display = 'none';
        
        // Create the grid cells
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            gridContainer.appendChild(cell);
            grid.push(null);
        }
        
        // Add initial tiles
        addRandomTile();
        addRandomTile();
    }

    // Add a new random tile (2 or 4) to an empty cell
    function addRandomTile() {
        const emptyCells = [];
        grid.forEach((cell, index) => {
            if (cell === null) {
                emptyCells.push(index);
            }
        });
        
        if (emptyCells.length > 0) {
            const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            addTile(randomIndex, value);
        }
    }

    // Add a tile to the grid
    function addTile(index, value, isNew = true, isMerged = false) {
        if (grid[index] !== null) return;
        
        const tile = document.createElement('div');
        tile.className = `tile tile-${value}`;
        if (isNew) tile.classList.add('tile-new');
        if (isMerged) tile.classList.add('tile-merged');
        tile.textContent = value;
        
        const cell = gridContainer.children[index];
        cell.appendChild(tile);
        
        grid[index] = {
            value,
            element: tile,
            merged: isMerged
        };
    }

    // Update the score
    function updateScore(points) {
        score += points;
        scoreDisplay.textContent = score;
        
        if (score > bestScore) {
            bestScore = score;
            bestScoreDisplay.textContent = bestScore;
            localStorage.setItem('bestScore', bestScore);
        }
    }

    // Check if there are any valid moves left
    function hasValidMoves() {
        // Check for empty cells
        if (grid.some(cell => cell === null)) {
            return true;
        }
        
        // Check for possible merges
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const index = i * GRID_SIZE + j;
                const value = grid[index].value;
                
                // Check right neighbor
                if (j < GRID_SIZE - 1 && grid[index + 1].value === value) {
                    return true;
                }
                
                // Check bottom neighbor
                if (i < GRID_SIZE - 1 && grid[index + GRID_SIZE].value === value) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Check if the game is won
    function checkWin() {
        if (gameWon) return true;
        
        const hasWon = grid.some(cell => cell !== null && cell.value === 2048);
        if (hasWon) {
            gameWon = true;
            gameWonElement.style.display = 'flex';
        }
        
        return hasWon;
    }

    // Handle game over
    function handleGameOver() {
        gameOver = true;
        gameOverElement.style.display = 'flex';
    }

    // Move tiles in the specified direction
    async function moveTiles(direction) {
        if (gameOver || !canMove) return false;
        
        let moved = false;
        const oldGrid = JSON.stringify(grid);
        
        // Clear merged flags
        grid.forEach(cell => {
            if (cell) cell.merged = false;
        });
        
        // Move and merge tiles based on direction
        if (direction === 'up' || direction === 'down') {
            for (let col = 0; col < GRID_SIZE; col++) {
                const column = [];
                for (let row = 0; row < GRID_SIZE; row++) {
                    const index = row * GRID_SIZE + col;
                    column.push(grid[index]);
                }
                
                const result = moveAndMerge(column, direction === 'up');
                moved = moved || result.moved;
                
                for (let row = 0; row < GRID_SIZE; row++) {
                    const index = row * GRID_SIZE + col;
                    grid[index] = result.tiles[row];
                }
            }
        } else { // left or right
            for (let row = 0; row < GRID_SIZE; row++) {
                const start = row * GRID_SIZE;
                const end = start + GRID_SIZE;
                const rowTiles = grid.slice(start, end);
                
                const result = moveAndMerge(rowTiles, direction === 'left');
                moved = moved || result.moved;
                
                for (let col = 0; col < GRID_SIZE; col++) {
                    grid[start + col] = result.tiles[col];
                }
            }
        }
        
        // If tiles moved, add a new random tile
        if (moved) {
            canMove = false;
            
            // Wait for animations to complete
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Remove all tiles from the DOM
            document.querySelectorAll('.tile').forEach(tile => tile.remove());
            
            // Re-render the grid with updated positions
            renderGrid();
            
            // Add a new random tile
            addRandomTile();
            
            // Check for win condition
            checkWin();
            
            // Check for game over
            if (!hasValidMoves()) {
                handleGameOver();
            }
            
            canMove = true;
        }
        
        return moved;
    }

    // Move and merge tiles in a single row/column
    function moveAndMerge(tiles, moveToStart) {
        const result = {
            moved: false,
            tiles: Array(GRID_SIZE).fill(null)
        };
        
        // Filter out null tiles
        let nonEmptyTiles = tiles.filter(tile => tile !== null);
        
        // If moving to end, reverse the array for easier processing
        if (!moveToStart) {
            nonEmptyTiles.reverse();
        }
        
        // Merge adjacent tiles with the same value
        for (let i = 0; i < nonEmptyTiles.length - 1; i++) {
            if (!nonEmptyTiles[i].merged && 
                nonEmptyTiles[i].value === nonEmptyTiles[i + 1]?.value) {
                const newValue = nonEmptyTiles[i].value * 2;
                
                // Create a new merged tile
                nonEmptyTiles[i] = {
                    value: newValue,
                    merged: true
                };
                
                // Remove the second tile
                nonEmptyTiles.splice(i + 1, 1);
                
                // Update score
                updateScore(newValue);
                
                result.moved = true;
            }
        }
        
        // Place the tiles in the result
        for (let i = 0; i < nonEmptyTiles.length; i++) {
            const pos = moveToStart ? i : GRID_SIZE - nonEmptyTiles.length + i;
            result.tiles[pos] = nonEmptyTiles[i];
            
            // Check if the tile has moved from its original position
            const originalPos = moveToStart ? i : nonEmptyTiles.length - 1 - i;
            if (tiles[originalPos] !== nonEmptyTiles[i]) {
                result.moved = true;
            }
        }
        
        return result;
    }
    
    // Render the grid based on the current state
    function renderGrid() {
        // Clear the grid
        document.querySelectorAll('.tile').forEach(tile => tile.remove());
        
        // Add all tiles to the grid
        grid.forEach((cell, index) => {
            if (cell !== null) {
                addTile(index, cell.value, false, cell.merged);
            }
        });
    }

    // Handle keyboard events
    function handleKeyDown(event) {
        if (gameOver || !canMove) return;
        
        let moved = false;
        
        switch (event.key) {
            case 'ArrowUp':
                moved = moveTiles('up');
                break;
            case 'ArrowRight':
                moved = moveTiles('right');
                break;
            case 'ArrowDown':
                moved = moveTiles('down');
                break;
            case 'ArrowLeft':
                moved = moveTiles('left');
                break;
            default:
                return; // Ignore other keys
        }
        
        // Prevent default only for arrow keys
        if (event.key.startsWith('Arrow')) {
            event.preventDefault();
        }
    }
    
    // Handle touch events for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    
    function handleTouchStart(event) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }
    
    function handleTouchEnd(event) {
        if (!touchStartX || !touchStartY) return;
        
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Determine the direction of the swipe
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 0) {
                moveTiles('right');
            } else {
                moveTiles('left');
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                moveTiles('down');
            } else {
                moveTiles('up');
            }
        }
        
        // Reset touch coordinates
        touchStartX = 0;
        touchStartY = 0;
    }

    // Event Listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // New Game button
    newGameBtn.addEventListener('click', initGame);
    
    // Try Again button
    tryAgainBtn.addEventListener('click', initGame);
    
    // Keep Playing button (after winning)
    keepPlayingBtn.addEventListener('click', () => {
        gameWonElement.style.display = 'none';
        gameWon = false; // Allow the game to continue
    });
    
    // New Game button in win screen
    newGameWinBtn.addEventListener('click', initGame);

    // Initialize the game
    initGame();
});
