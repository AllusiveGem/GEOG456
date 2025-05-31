import pygame
import sys
import random
import math
from pygame import gfxdraw

# Initialize pygame
pygame.init()
pygame.mixer.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bouncing Marble Horses Race")

# Colors
BG_COLOR = (240, 240, 245)
CARROT_COLOR = (255, 165, 0)
TEXT_COLOR = (50, 50, 50)

# Load sounds (comment out if you don't have the files)
try:
    bounce_sound = pygame.mixer.Sound("bounce.wav")
    win_sound = pygame.mixer.Sound("win.wav")
    has_sound = True
except:
    has_sound = False
    print("Sound files not found, continuing without sound")

# Horse marble class
class HorseMarble:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = random.randint(15, 25)
        self.speed_x = random.uniform(2, 5) * random.choice([-1, 1])
        self.speed_y = random.uniform(2, 5) * random.choice([-1, 1])
        self.color = (
            random.randint(50, 255),
            random.randint(50, 255),
            random.randint(50, 255)
        )
        self.trail = []
        self.max_trail = 20
        self.winner = False
        self.name = random.choice(["Thunder", "Lightning", "Storm", "Blaze", "Shadow", 
                                 "Comet", "Flash", "Bolt", "Spirit", "Dash"])
    
    def move(self):
        if self.winner:
            return
            
        # Move the marble
        self.x += self.speed_x
        self.y += self.speed_y
        
        # Add current position to trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > self.max_trail:
            self.trail.pop(0)
        
        # Bounce off walls
        if self.x - self.radius <= 0 or self.x + self.radius >= WIDTH:
            self.speed_x *= -1
            if has_sound:
                bounce_sound.play()
        if self.y - self.radius <= 0 or self.y + self.radius >= HEIGHT:
            self.speed_y *= -1
            if has_sound:
                bounce_sound.play()
    
    def draw(self, surface):
        # Draw trail
        for i, (tx, ty) in enumerate(self.trail):
            alpha = int(255 * (i / len(self.trail)))
            radius = int(self.radius * (i / len(self.trail)))
            trail_surf = pygame.Surface((radius*2, radius*2), pygame.SRCALPHA)
            pygame.draw.circle(
                trail_surf, 
                (*self.color, alpha), 
                (radius, radius), 
                radius
            )
            surface.blit(trail_surf, (tx - radius, ty - radius))
        
        # Draw marble with gradient effect
        gfxdraw.filled_circle(
            surface, 
            int(self.x), int(self.y), 
            self.radius, 
            self.color
        )
        gfxdraw.aacircle(
            surface, 
            int(self.x), int(self.y), 
            self.radius, 
            (min(self.color[0]+50, 255), min(self.color[1]+50, 255), min(self.color[2]+50, 255))
        )
        
        # Draw name if winner
        if self.winner:
            font = pygame.font.SysFont('Arial', 24)
            text = font.render(f"{self.name} wins!", True, TEXT_COLOR)
            surface.blit(text, (self.x - text.get_width()//2, self.y - self.radius - 30))
    
    def check_collision(self, carrot_rect):
        if self.winner:
            return False
            
        # Simple circle-rectangle collision
        closest_x = max(carrot_rect.left, min(self.x, carrot_rect.right))
        closest_y = max(carrot_rect.top, min(self.y, carrot_rect.bottom))
        
        distance = math.sqrt((self.x - closest_x)**2 + (self.y - closest_y)**2)
        
        if distance < self.radius:
            self.winner = True
            if has_sound:
                win_sound.play()
            return True
        return False

# Carrot class
class Carrot:
    def __init__(self):
        self.size = 40
        self.x = random.randint(100, WIDTH - 100)
        self.y = random.randint(100, HEIGHT - 100)
        self.rect = pygame.Rect(self.x, self.y, self.size, self.size)
        self.visible = True
    
    def draw(self, surface):
        if not self.visible:
            return
            
        # Draw carrot body
        pygame.draw.rect(surface, CARROT_COLOR, self.rect)
        pygame.draw.polygon(surface, (0, 150, 0), [
            (self.x + self.size//2, self.y - 10),
            (self.x + self.size + 15, self.y + self.size//3),
            (self.x + self.size//2, self.y + 5)
        ])

# Create objects
marbles = [HorseMarble(random.randint(50, WIDTH-50), random.randint(50, HEIGHT-50)) for _ in range(5)]
carrot = Carrot()
winner = None
celebration_particles = []

# Main game loop
clock = pygame.time.Clock()
running = True

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_r:  # Reset game
                marbles = [HorseMarble(random.randint(50, WIDTH-50), random.randint(50, HEIGHT-50)) for _ in range(5)]
                carrot = Carrot()
                winner = None
                celebration_particles = []
    
    # Clear screen
    screen.fill(BG_COLOR)
    
    # Move and draw marbles
    for marble in marbles:
        marble.move()
        marble.draw(screen)
        
        # Check for carrot collision
        if carrot.visible and marble.check_collision(carrot.rect):
            winner = marble
            carrot.visible = False
            
            # Create celebration particles
            for _ in range(100):
                celebration_particles.append({
                    'x': marble.x,
                    'y': marble.y,
                    'speed_x': random.uniform(-5, 5),
                    'speed_y': random.uniform(-5, 5),
                    'color': marble.color,
                    'size': random.randint(2, 6),
                    'life': random.randint(30, 60)
                })
    
    # Update and draw celebration particles
    for particle in celebration_particles[:]:
        particle['x'] += particle['speed_x']
        particle['y'] += particle['speed_y']
        particle['life'] -= 1
        
        pygame.draw.circle(
            screen,
            particle['color'],
            (int(particle['x']), int(particle['y'])),
            particle['size']
        )
        
        if particle['life'] <= 0:
            celebration_particles.remove(particle)
    
    # Draw carrot
    carrot.draw(screen)
    
    # Draw instructions
    font = pygame.font.SysFont('Arial', 18)
    text = font.render("Press R to reset", True, TEXT_COLOR)
    screen.blit(text, (10, 10))
    
    # Display winner message
    if winner:
        font = pygame.font.SysFont('Arial', 36, bold=True)
        text = font.render(f"{winner.name} got the carrot!", True, TEXT_COLOR)
        screen.blit(text, (WIDTH//2 - text.get_width()//2, 50))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()

