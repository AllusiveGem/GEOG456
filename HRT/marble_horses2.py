import pygame
import sys
import random
import math
import json
import os
from pygame import gfxdraw
from datetime import datetime

# Initialize pygame
pygame.init()
pygame.mixer.init()

# Screen dimensions
WIDTH, HEIGHT = 1000, 700
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Horse Racing Championship")

# Colors
BG_COLOR = (240, 240, 245)
TEXT_COLOR = (50, 50, 50)
BUTTON_COLOR = (70, 130, 180)
BUTTON_HOVER_COLOR = (100, 150, 200)

# Game states
MENU = 0
CUSTOMIZATION = 1
RACING = 2
RESULTS = 3
current_state = MENU

# Load assets
def load_image(name, scale=1):
    try:
        image = pygame.image.load(f"assets/{name}")
        return pygame.transform.scale(image, (int(image.get_width() * scale), int(image.get_height() * scale)))
    except:
        # Fallback rectangle if image missing
        surf = pygame.Surface((50, 50), pygame.SRCALPHA)
        pygame.draw.rect(surf, (255, 165, 0), (0, 0, 50, 50))
        return surf

# Try to load images (create assets folder and add these images)
carrot_img = load_image("carrot.png", 0.5)
horse_img = load_image("horse.png", 0.2)
obstacle_img = load_image("obstacle.png", 0.3)

# Load sounds
def load_sound(name):
    try:
        return pygame.mixer.Sound(f"assets/{name}")
    except:
        return None

bounce_sound = load_sound("bounce.wav")
collision_sound = load_sound("collision.wav")
win_sound = load_sound("win.wav")
start_sound = load_sound("start.wav")

# Fonts
font_small = pygame.font.SysFont('Arial', 18)
font_medium = pygame.font.SysFont('Arial', 24)
font_large = pygame.font.SysFont('Arial', 36, bold=True)

# Horse class
class Horse:
    def __init__(self, x, y, name, color):
        self.x = x
        self.y = y
        self.radius = 30
        self.speed_x = 0
        self.speed_y = 0
        self.color = color
        self.name = name
        self.trail = []
        self.max_trail = 15
        self.winner = False
        self.finished = False
        self.finish_time = 0
        self.image = horse_img.copy()
        self.tint_image(color)
        
    def tint_image(self, color):
        """Apply color tint to horse image"""
        colored_image = pygame.Surface(self.image.get_size(), pygame.SRCALPHA)
        colored_image.fill((*color, 0))
        self.image.blit(colored_image, (0, 0), special_flags=pygame.BLEND_ADD)
        
    def start_race(self):
        self.speed_x = random.uniform(3, 6) * random.choice([-1, 1])
        self.speed_y = random.uniform(3, 6) * random.choice([-1, 1])
        
    def move(self, obstacles):
        if self.finished:
            return
            
        # Store previous position for collision detection
        old_x, old_y = self.x, self.y
        
        # Move the horse
        self.x += self.speed_x
        self.y += self.speed_y
        
        # Add to trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > self.max_trail:
            self.trail.pop(0)
            
        # Check wall collisions
        if self.x - self.radius <= 0 or self.x + self.radius >= WIDTH:
            self.speed_x *= -1
            if bounce_sound: bounce_sound.play()
            
        if self.y - self.radius <= 0 or self.y + self.radius >= HEIGHT:
            self.speed_y *= -1
            if bounce_sound: bounce_sound.play()
            
        # Check obstacle collisions
        for obstacle in obstacles:
            if self.check_collision(obstacle):
                # Calculate reflection
                dx = self.x - obstacle.x
                dy = self.y - obstacle.y
                distance = max(1, math.sqrt(dx*dx + dy*dy))
                
                # Normalize and reflect
                nx = dx / distance
                ny = dy / distance
                dot_product = self.speed_x * nx + self.speed_y * ny
                self.speed_x = self.speed_x - 2 * dot_product * nx
                self.speed_y = self.speed_y - 2 * dot_product * ny
                
                # Add some randomness
                self.speed_x += random.uniform(-1, 1)
                self.speed_y += random.uniform(-1, 1)
                
                if collision_sound: collision_sound.play()
                
                # Move back to avoid sticking
                self.x = old_x
                self.y = old_y
                break
                
    def check_collision(self, other):
        distance = math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)
        return distance < (self.radius + other.radius)
        
    def draw(self, surface):
        # Draw trail
        for i, (tx, ty) in enumerate(self.trail):
            alpha = int(200 * (i / len(self.trail)))
            size = int(self.radius * 0.7 * (i / len(self.trail)))
            trail_surf = pygame.Surface((size*2, size*2), pygame.SRCALPHA)
            pygame.draw.circle(trail_surf, (*self.color, alpha), (size, size), size)
            surface.blit(trail_surf, (tx - size, ty - size))
            
        # Draw horse
        rotated_img = pygame.transform.rotate(self.image, 
            -math.degrees(math.atan2(self.speed_y, self.speed_x)) - 90)
        img_rect = rotated_img.get_rect(center=(self.x, self.y))
        surface.blit(rotated_img, img_rect)
        
        # Draw name
        if not self.finished:
            text = font_small.render(self.name, True, TEXT_COLOR)
            surface.blit(text, (self.x - text.get_width()//2, self.y - self.radius - 20))

# Obstacle class
class Obstacle:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = random.randint(20, 40)
        
    def draw(self, surface):
        pygame.draw.circle(surface, (150, 75, 0), (self.x, self.y), self.radius)
        # Or use image if available
        if obstacle_img:
            img_rect = obstacle_img.get_rect(center=(self.x, self.y))
            surface.blit(obstacle_img, img_rect)

# Carrot class
class Carrot:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 25
        self.collected = False
        
    def draw(self, surface):
        if not self.collected:
            if carrot_img:
                img_rect = carrot_img.get_rect(center=(self.x, self.y))
                surface.blit(carrot_img, img_rect)
            else:
                pygame.draw.circle(surface, (255, 165, 0), (self.x, self.y), self.radius)

# Button class
class Button:
    def __init__(self, x, y, width, height, text, action=None):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.action = action
        self.is_hovered = False
        
    def draw(self, surface):
        color = BUTTON_HOVER_COLOR if self.is_hovered else BUTTON_COLOR
        pygame.draw.rect(surface, color, self.rect, border_radius=10)
        pygame.draw.rect(surface, (255, 255, 255), self.rect, 2, border_radius=10)
        
        text = font_medium.render(self.text, True, (255, 255, 255))
        text_rect = text.get_rect(center=self.rect.center)
        surface.blit(text, text_rect)
        
    def check_hover(self, pos):
        self.is_hovered = self.rect.collidepoint(pos)
        return self.is_hovered
        
    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and self.is_hovered:
            if self.action:
                self.action()

# Game manager
class Game:
    def __init__(self):
        self.horses = []
        self.obstacles = []
        self.carrot = None
        self.race_started = False
        self.race_finished = False
        self.leaderboard = []
        self.current_stage = 1
        self.max_stages = 5
        self.load_leaderboard()
        
    def load_leaderboard(self):
        try:
            with open('leaderboard.json', 'r') as f:
                self.leaderboard = json.load(f)
        except:
            self.leaderboard = []
            
    def save_leaderboard(self):
        with open('leaderboard.json', 'w') as f:
            json.dump(self.leaderboard, f)
            
    def add_to_leaderboard(self, name, time, stage):
        self.leaderboard.append({
            'name': name,
            'time': time,
            'stage': stage,
            'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        # Keep only top 10
        self.leaderboard = sorted(self.leaderboard, key=lambda x: x['time'])[:10]
        self.save_leaderboard()
        
    def setup_race(self):
        self.race_started = False
        self.race_finished = False
        self.obstacles = []
        self.carrot = Carrot(random.randint(100, WIDTH-100), random.randint(100, HEIGHT-100))
        
        # Create random obstacles
        for _ in range(10 + self.current_stage * 3):
            x = random.randint(50, WIDTH-50)
            y = random.randint(50, HEIGHT-50)
            # Ensure not too close to start or carrot
            if math.sqrt((x - WIDTH//2)**2 + (y - HEIGHT//2)**2) > 150 and \
               math.sqrt((x - self.carrot.x)**2 + (y - self.carrot.y)**2) > 150:
                self.obstacles.append(Obstacle(x, y))
        
        # Position horses at starting line
        start_y = HEIGHT // 2
        spacing = 60
        for i, horse in enumerate(self.horses):
            horse.x = WIDTH // 2
            horse.y = start_y + (i - len(self.horses)//2) * spacing
            horse.speed_x = 0
            horse.speed_y = 0
            horse.finished = False
            horse.winner = False
            horse.trail = []
            
    def start_race(self):
        if not self.race_started:
            self.race_started = True
            self.race_start_time = pygame.time.get_ticks()
            if start_sound: start_sound.play()
            for horse in self.horses:
                horse.start_race()
                
    def update(self):
        if not self.race_started or self.race_finished:
            return
            
        all_finished = True
        for horse in self.horses:
            if not horse.finished:
                horse.move(self.obstacles)
                
                # Check horse-horse collisions
                for other in self.horses:
                    if other != horse and not other.finished:
                        if horse.check_collision(other):
                            # Simple bounce effect
                            horse.speed_x, other.speed_x = other.speed_x, horse.speed_x
                            horse.speed_y, other.speed_y = other.speed_y, horse.speed_y
                            if collision_sound: collision_sound.play()
                
                # Check carrot collision
                if not horse.finished and horse.check_collision(self.carrot):
                    horse.finished = True
                    horse.winner = True
                    self.carrot.collected = True
                    horse.finish_time = (pygame.time.get_ticks() - self.race_start_time) / 1000
                    if win_sound: win_sound.play()
                    self.add_to_leaderboard(horse.name, horse.finish_time, self.current_stage)
                    
            if not horse.finished:
                all_finished = False
                
        self.race_finished = all_finished
        
    def draw(self, surface):
        # Draw background
        surface.fill(BG_COLOR)
        
        # Draw stage info
        stage_text = font_medium.render(f"Stage {self.current_stage}/{self.max_stages}", True, TEXT_COLOR)
        surface.blit(stage_text, (20, 20))
        
        # Draw obstacles
        for obstacle in self.obstacles:
            obstacle.draw(surface)
            
        # Draw carrot
        self.carrot.draw(surface)
        
        # Draw horses
        for horse in self.horses:
            horse.draw(surface)
            
        # Draw race info
        if self.race_started and not self.race_finished:
            race_time = (pygame.time.get_ticks() - self.race_start_time) / 1000
            time_text = font_medium.render(f"Time: {race_time:.2f}s", True, TEXT_COLOR)
            surface.blit(time_text, (WIDTH - 150, 20))
            
        # Draw winner info
        winners = [h for h in self.horses if h.winner]
        if winners:
            winner = winners[0]
            text = font_large.render(f"{winner.name} wins in {winner.finish_time:.2f}s!", True, TEXT_COLOR)
            surface.blit(text, (WIDTH//2 - text.get_width()//2, 50))
            
            # Next stage button
            if self.current_stage < self.max_stages:
                next_button = Button(WIDTH//2 - 100, HEIGHT - 100, 200, 50, "Next Stage", self.next_stage)
                next_button.check_hover(pygame.mouse.get_pos())
                next_button.draw(surface)
                return next_button
                
        return None
        
    def next_stage(self):
        self.current_stage += 1
        if self.current_stage > self.max_stages:
            self.current_stage = 1
        self.setup_race()

# Create game instance
game = Game()

# Customization variables
custom_name = "Thunder"
custom_color = (random.randint(50, 255), random.randint(50, 255), random.randint(50, 255))

# Create UI buttons
start_button = Button(WIDTH//2 - 100, HEIGHT//2 - 80, 200, 50, "Start Race", lambda: setattr(game, 'race_started', True))
customize_button = Button(WIDTH//2 - 100, HEIGHT//2, 200, 50, "Customize", lambda: globals().update({'current_state': CUSTOMIZATION}))
leaderboard_button = Button(WIDTH//2 - 100, HEIGHT//2 + 80, 200, 50, "Leaderboard", lambda: globals().update({'current_state': RESULTS}))
back_button = Button(50, HEIGHT - 70, 100, 40, "Back", lambda: globals().update({'current_state': MENU}))
start_race_button = Button(WIDTH//2 - 100, HEIGHT - 100, 200, 50, "Start Race", game.start_race)

# Main game loop
clock = pygame.time.Clock()
running = True

while running:
    mouse_pos = pygame.mouse.get_pos()
    current_button = None
    
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
            
        if event.type == pygame.MOUSEBUTTONDOWN:
            if current_state == MENU:
                start_button.handle_event(event)
                customize_button.handle_event(event)
                leaderboard_button.handle_event(event)
            elif current_state == RACING:
                if not game.race_started:
                    start_race_button.handle_event(event)
                else:
                    btn = game.draw(screen)
                    if btn: btn.handle_event(event)
            elif current_state in [CUSTOMIZATION, RESULTS]:
                back_button.handle_event(event)
    
    # Update
    if current_state == RACING:
        game.update()
        
    # Draw
    screen.fill(BG_COLOR)
    
    if current_state == MENU:
        # Draw title
        title = font_large.render("Horse Racing Championship", True, TEXT_COLOR)
        screen.blit(title, (WIDTH//2 - title.get_width()//2, 100))
        
        # Draw buttons
        start_button.check_hover(mouse_pos)
        customize_button.check_hover(mouse_pos)
        leaderboard_button.check_hover(mouse_pos)
        
        start_button.draw(screen)
        customize_button.draw(screen)
        leaderboard_button.draw(screen)
        
    elif current_state == CUSTOMIZATION:
        # Draw customization UI
        title = font_large.render("Customize Your Horse", True, TEXT_COLOR)
        screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        # Name input
        name_label = font_medium.render("Horse Name:", True, TEXT_COLOR)
        screen.blit(name_label, (WIDTH//2 - 200, 150))
        
        name_rect = pygame.Rect(WIDTH//2 - 50, 150, 200, 30)
        pygame.draw.rect(screen, (255, 255, 255), name_rect, 2)
        name_text = font_medium.render(custom_name, True, TEXT_COLOR)
        screen.blit(name_text, (name_rect.x + 5, name_rect.y + 5))
        
        # Color picker
        color_label = font_medium.render("Horse Color:", True, TEXT_COLOR)
        screen.blit(color_label, (WIDTH//2 - 200, 200))
        
        color_rect = pygame.Rect(WIDTH//2 - 50, 200, 50, 50)
        pygame.draw.rect(screen, custom_color, color_rect)
        
        # Random color button
        random_color_button = Button(WIDTH//2 + 20, 200, 130, 50, "Random", 
                                   lambda: globals().update({'custom_color': (random.randint(50, 255), random.randint(50, 255), random.randint(50, 255))}))
        random_color_button.check_hover(mouse_pos)
        random_color_button.draw(screen)
        
        # Add horse button
        add_horse_button = Button(WIDTH//2 - 100, 300, 200, 50, "Add Horse", 
                                lambda: game.horses.append(Horse(0, 0, custom_name, custom_color)))
        add_horse_button.check_hover(mouse_pos)
        add_horse_button.draw(screen)
        
        # Start game button
        if game.horses:
            start_game_button = Button(WIDTH//2 - 100, 370, 200, 50, "Start Game", 
                                      lambda: [globals().update({'current_state': RACING}), game.setup_race()])
            start_game_button.check_hover(mouse_pos)
            start_game_button.draw(screen)
        
        # Back button
        back_button.check_hover(mouse_pos)
        back_button.draw(screen)
        
    elif current_state == RACING:
        # Draw game
        btn = game.draw(screen)
        if not game.race_started:
            start_race_button.check_hover(mouse_pos)
            start_race_button.draw(screen)
            
    elif current_state == RESULTS:
        # Draw leaderboard
        title = font_large.render("Leaderboard", True, TEXT_COLOR)
        screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        if game.leaderboard:
            for i, entry in enumerate(game.leaderboard[:10]):
                entry_text = font_medium.render(
                    f"{i+1}. {entry['name']} - Stage {entry['stage']}: {entry['time']:.2f}s ({entry['date']})", 
                    True, TEXT_COLOR)
                screen.blit(entry_text, (WIDTH//2 - 300, 120 + i * 30))
        else:
            no_data = font_medium.render("No race data yet!", True, TEXT_COLOR)
            screen.blit(no_data, (WIDTH//2 - no_data.get_width()//2, 200))
        
        back_button.check_hover(mouse_pos)
        back_button.draw(screen)
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()