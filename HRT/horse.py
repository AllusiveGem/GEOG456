import pygame
import sys
import random
import math
import os
from pygame import gfxdraw

# Initialize pygame
pygame.init()
pygame.mixer.init()

# Screen dimensions
WIDTH, HEIGHT = 1000, 700
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bouncing Horse Race")

# Colors
BG_COLOR = (240, 240, 245)
TEXT_COLOR = (50, 50, 50)
WALL_COLOR = (100, 100, 100)

# Fonts
font_small = pygame.font.SysFont('Arial', 18)
font_medium = pygame.font.SysFont('Arial', 24)
font_large = pygame.font.SysFont('Arial', 36, bold=True)

# Horse names
HORSE_NAMES = ["Thunder", "Lightning", "Blaze", "Storm", "Flash", "Bolt", "Spirit"]

# Game stats
game_stats = {
    "total_games": 0,
    "wins": {name: 0 for name in HORSE_NAMES}
}

# Load sounds
try:
    bounce_sounds = [pygame.mixer.Sound(f"bounce_{i}.wav") for i in range(7)]
    win_sound = pygame.mixer.Sound("win.wav")
    has_sound = True
except:
    has_sound = False
    print("Sound files not found, continuing without sound")

# Create horse sprites
def create_horse_sprite(color):
    surf = pygame.Surface((60, 60), pygame.SRCALPHA)
    # Body (bean shape)
    pygame.draw.ellipse(surf, color, (10, 20, 40, 30))
    # Head
    pygame.draw.circle(surf, color, (45, 25), 8)
    # Eye
    pygame.draw.circle(surf, (0, 0, 0), (47, 23), 2)
    return surf

# Create carrot sprite
def create_carrot_sprite():
    surf = pygame.Surface((40, 40), pygame.SRCALPHA)
    # Carrot body
    pygame.draw.polygon(surf, (255, 165, 0), [(20, 40), (10, 20), (30, 20)])
    # Leaves
    pygame.draw.polygon(surf, (0, 200, 0), [(20, 20), (10, 0), (30, 0)])
    return surf

# Horse class
class Horse:
    def __init__(self, x, y, name, color, index):
        self.x = x
        self.y = y
        self.radius = 30
        self.speed_x = random.uniform(2, 5) * random.choice([-1, 1])
        self.speed_y = random.uniform(2, 5) * random.choice([-1, 1])
        self.color = color
        self.name = name
        self.image = create_horse_sprite(color)
        self.winner = False
        self.index = index
        self.trail = []
        
    def move(self, walls):
        # Store previous position
        old_x, old_y = self.x, self.y
        
        # Move the horse
        self.x += self.speed_x
        self.y += self.speed_y
        
        # Add to trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > 10:
            self.trail.pop(0)
            
        # Check wall collisions
        for wall in walls:
            if self.check_wall_collision(wall):
                # Calculate reflection
                if wall.type == "horizontal":
                    self.speed_y *= -1
                else:
                    self.speed_x *= -1
                
                if has_sound:
                    bounce_sounds[self.index].play()
                
                # Move back to avoid sticking
                self.x = old_x
                self.y = old_y
                break
                
    def check_wall_collision(self, wall):
        if wall.type == "horizontal":
            return (self.y - self.radius <= wall.pos and self.speed_y < 0) or \
                   (self.y + self.radius >= wall.pos and self.speed_y > 0)
        else:
            return (self.x - self.radius <= wall.pos and self.speed_x < 0) or \
                   (self.x + self.radius >= wall.pos and self.speed_x > 0)
        
    def draw(self, surface):
        # Draw trail
        for i, (tx, ty) in enumerate(self.trail):
            alpha = int(200 * (i / len(self.trail)))
            size = int(self.radius * 0.5 * (i / len(self.trail)))
            trail_surf = pygame.Surface((size*2, size*2), pygame.SRCALPHA)
            pygame.draw.circle(trail_surf, (*self.color, alpha), (size, size), size)
            surface.blit(trail_surf, (tx - size, ty - size))
            
        # Draw horse
        angle = math.degrees(math.atan2(self.speed_y, self.speed_x)) + 90
        rotated_img = pygame.transform.rotate(self.image, -angle)
        img_rect = rotated_img.get_rect(center=(self.x, self.y))
        surface.blit(rotated_img, img_rect)
        
        # Draw name
        text = font_small.render(self.name, True, TEXT_COLOR)
        surface.blit(text, (self.x - text.get_width()//2, self.y - self.radius - 20))

# Carrot class
class Carrot:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 25
        self.collected = False
        self.image = create_carrot_sprite()
        
    def draw(self, surface):
        if not self.collected:
            img_rect = self.image.get_rect(center=(self.x, self.y))
            surface.blit(self.image, img_rect)

# Wall class
class Wall:
    def __init__(self, x1, y1, x2, y2):
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        if x1 == x2:
            self.type = "vertical"
            self.pos = x1
        else:
            self.type = "horizontal"
            self.pos = y1
            
    def draw(self, surface):
        pygame.draw.line(surface, WALL_COLOR, (self.x1, self.y1), (self.x2, self.y2), 5)

# Game maps
MAPS = [
    # Simple open map
    [],
    
    # Map with horizontal divider
    [Wall(0, HEIGHT//2, WIDTH, HEIGHT//2)],
    
    # Map with vertical divider
    [Wall(WIDTH//2, 0, WIDTH//2, HEIGHT)],
    
    # Map with cross
    [Wall(0, HEIGHT//2, WIDTH, HEIGHT//2),
     Wall(WIDTH//2, 0, WIDTH//2, HEIGHT)],
     
    # Map with box
    [Wall(WIDTH//4, HEIGHT//4, 3*WIDTH//4, HEIGHT//4),
     Wall(WIDTH//4, 3*HEIGHT//4, 3*WIDTH//4, 3*HEIGHT//4),
     Wall(WIDTH//4, HEIGHT//4, WIDTH//4, 3*HEIGHT//4),
     Wall(3*WIDTH//4, HEIGHT//4, 3*WIDTH//4, 3*HEIGHT//4)]
]

# Create game objects
def setup_game():
    global horses, carrot, walls, race_finished
    
    # Select random map
    walls = random.choice(MAPS)
    
    # Add border walls
    walls.extend([
        Wall(0, 0, WIDTH, 0),          # Top
        Wall(0, HEIGHT, WIDTH, HEIGHT), # Bottom
        Wall(0, 0, 0, HEIGHT),          # Left
        Wall(WIDTH, 0, WIDTH, HEIGHT)   # Right
    ])
    
    # Create horses
    horse_colors = [
        (255, 0, 0), (0, 0, 255), (0, 255, 0),
        (255, 255, 0), (255, 0, 255), (0, 255, 255),
        (128, 0, 128)
    ]
    horses = [
        Horse(random.randint(100, WIDTH-100), 
        random.randint(100, HEIGHT-100),
        HORSE_NAMES[i], 
        horse_colors[i],
        i
    ) for i in range(7)]
    
    # Place carrot at center
    carrot = Carrot(WIDTH//2, HEIGHT//2)
    race_finished = False

# Initialize game
setup_game()
clock = pygame.time.Clock()
running = True

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_r:  # Reset game
                setup_game()
    
    # Update game state
    if not race_finished:
        for horse in horses:
            if not horse.winner:
                horse.move(walls)
                
                # Check carrot collision
                distance = math.sqrt((horse.x - carrot.x)**2 + (horse.y - carrot.y)**2)
                if distance < (horse.radius + carrot.radius):
                    horse.winner = True
                    carrot.collected = True
                    race_finished = True
                    game_stats["total_games"] += 1
                    game_stats["wins"][horse.name] += 1
                    if has_sound:
                        win_sound.play()
    
    # Draw everything
    screen.fill(BG_COLOR)
    
    # Draw walls
    for wall in walls:
        wall.draw(screen)
    
    # Draw carrot
    carrot.draw(screen)
    
    # Draw horses
    for horse in horses:
        horse.draw(screen)
    
    # Draw stats
    stats_text = [
        f"Total races: {game_stats['total_games']}",
        "Wins:"
    ]
    
    # Add each horse's win count and percentage
    for name in HORSE_NAMES:
        wins = game_stats['wins'][name]
        percentage = (wins / game_stats['total_games'] * 100) if game_stats['total_games'] > 0 else 0
        stats_text.append(f"{name}: {wins} ({percentage:.1f}%)")
    
    # Render stats
    for i, text in enumerate(stats_text):
        rendered_text = font_medium.render(text, True, TEXT_COLOR)
        screen.blit(rendered_text, (20, 20 + i * 25))
    
    # Draw winner message
    if race_finished:
        winner = next(horse for horse in horses if horse.winner)
        text = font_large.render(f"{winner.name} wins!", True, winner.color)
        screen.blit(text, (WIDTH//2 - text.get_width()//2, 50))
        
        # Draw restart prompt
        restart_text = font_medium.render("Press R to restart", True, TEXT_COLOR)
        screen.blit(restart_text, (WIDTH//2 - restart_text.get_width()//2, HEIGHT - 50))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()