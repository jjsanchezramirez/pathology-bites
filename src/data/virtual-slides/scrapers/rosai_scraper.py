import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import requests
from urllib.parse import urljoin

class RosaiCollectionScraper:
    def __init__(self, headless=False):
        """Initialize the Rosai Collection scraper"""
        self.base_url = "https://rosaicollection.net"
        self.collection_url = "https://rosaicollection.net/collection"
        
        # Configure Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        print("🚀 Starting Chrome browser for Rosai Collection Scraper...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, 30)
        
        # Keep track of URLs to avoid duplicates
        self.seen_case_urls = set()
        self.seen_image_urls = set()
        self.all_cases = []
        
    def __del__(self):
        """Clean up the browser when done"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def get_categories(self):
        """Get all pathology categories from the homepage"""
        try:
            print("🔍 Getting pathology categories from Rosai Collection...")
            self.driver.get(self.base_url)
            time.sleep(5)
            
            # Debug: Print page title to confirm we're on the right page
            page_title = self.driver.title
            print(f"   📄 Page title: {page_title}")
            
            # Find the category list
            categories = []
            try:
                # Wait for the page to fully load
                time.sleep(3)
                
                # Look for the "Main Categories (Slides)" section
                # Try multiple selectors to find the category list
                selectors_to_try = [
                    ".category_list a",
                    "ul.category_list a", 
                    ".category_list li a",
                    "ul.category_list li a"
                ]
                
                category_links = []
                for selector in selectors_to_try:
                    try:
                        links = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        if links:
                            category_links = links
                            print(f"   ✅ Found {len(links)} category links using selector: {selector}")
                            break
                    except Exception as e:
                        print(f"   ⚠️ Selector {selector} failed: {e}")
                        continue
                
                if not category_links:
                    # Debug: Try to find any links on the page
                    all_links = self.driver.find_elements(By.TAG_NAME, "a")
                    print(f"   🔍 Debug: Found {len(all_links)} total links on page")
                    
                    # Show first few links for debugging
                    for i, link in enumerate(all_links[:10]):
                        href = link.get_attribute('href') or 'No href'
                        text = link.text.strip() or 'No text'
                        print(f"      Link {i+1}: {text} -> {href}")
                    
                    # Try to find category links by href pattern
                    category_links = [link for link in all_links if link.get_attribute('href') and '/collection/' in link.get_attribute('href') and '?' in link.get_attribute('href')]
                    print(f"   🔍 Found {len(category_links)} links with /collection/ pattern")
                    
                    # If still no links, save page source for debugging
                    if not category_links:
                        try:
                            page_source = self.driver.page_source
                            with open('rosai_debug_page.html', 'w', encoding='utf-8') as f:
                                f.write(page_source)
                            print("   💾 Saved page source to 'rosai_debug_page.html' for debugging")
                            
                            # Try to find categories by text content
                            if 'Bone' in page_source and 'Breast' in page_source:
                                print("   🔍 Found category names in page source, but links not accessible")
                                print("   💡 This might be a JavaScript loading issue")
                                
                                # Wait longer and try again
                                print("   ⏳ Waiting 10 seconds for JavaScript to load...")
                                time.sleep(10)
                                
                                # Try one more time with longer wait
                                for selector in selectors_to_try:
                                    try:
                                        links = self.driver.find_elements(By.CSS_SELECTOR, selector)
                                        if links:
                                            category_links = links
                                            print(f"   ✅ Found {len(links)} category links after waiting: {selector}")
                                            break
                                    except:
                                        continue
                                        
                        except Exception as debug_error:
                            print(f"   ⚠️ Debug save failed: {debug_error}")
                
                # Extract category information
                for link in category_links:
                    try:
                        href = link.get_attribute('href')
                        text = link.text.strip()
                        
                        # Skip if no useful data
                        if not href or not text or len(text) < 3:
                            continue
                            
                        print(f"   🔍 Processing: '{text}' -> {href}")
                        
                        # For Rosai Collection, the count is in the parent <li> element
                        # HTML structure: <li><a href="...">Bone</a> (246)</li>
                        count = 0
                        try:
                            # Get the parent <li> element
                            parent_li = link.find_element(By.XPATH, "..")
                            full_text = parent_li.text.strip()
                            
                            # Extract count from parentheses in the full text
                            if '(' in full_text and ')' in full_text:
                                count_str = full_text.split('(')[-1].split(')')[0].strip()
                                try:
                                    count = int(count_str)
                                except:
                                    count = 0
                        except:
                            # If we can't get the count, just use 0
                            count = 0
                        
                        # Extract slug from URL
                        slug = ''
                        if '/collection/' in href:
                            parts = href.split('/collection/')
                            if len(parts) > 1:
                                slug = parts[1].split('/')[0].split('?')[0]
                        
                        # Always add the category, even without count
                        categories.append({
                            'name': text,  # Just the category name (e.g., "Bone")
                            'url': href,
                            'count': count,
                            'slug': slug
                        })
                        
                        print(f"      ✅ Added category: {text} ({count} slides)")
                        
                    except Exception as e:
                        print(f"      ⚠️ Error processing link: {e}")
                        continue
                
                print(f"📊 Found {len(categories)} pathology categories:")
                for i, cat in enumerate(categories):
                    print(f"   {i+1}. {cat['name']} ({cat['count']} slides)")
                
                return categories
                
            except Exception as e:
                print(f"   ❌ Error extracting categories: {e}")
                # Print page source snippet for debugging
                try:
                    page_source = self.driver.page_source
                    if 'category_list' in page_source:
                        print("   🔍 Found 'category_list' in page source")
                    else:
                        print("   ⚠️ 'category_list' not found in page source")
                        
                    # Look for the word "Bone" which should be the first category
                    if 'Bone' in page_source:
                        print("   🔍 Found 'Bone' in page source")
                    else:
                        print("   ⚠️ 'Bone' not found in page source")
                        
                except:
                    pass
                return []
                
        except Exception as e:
            print(f"❌ Error getting categories: {e}")
            return []
    
    def scrape_category(self, category):
        """Scrape all cases from a specific category"""
        try:
            print(f"\n🔍 Scraping category: {category['name']} ({category['count']} slides)")
            
            # Navigate to category page
            self.driver.get(category['url'])
            time.sleep(5)
            
            category_cases = []
            
            # Look for seminars in this category
            seminars = self.get_seminars_from_category()
            
            for seminar in seminars:
                print(f"   📋 Processing seminar: {seminar['title']}")
                seminar_cases = self.scrape_seminar(seminar, category['name'])
                category_cases.extend(seminar_cases)
                
                # Brief pause between seminars
                time.sleep(2)
            
            print(f"✅ Finished {category['name']}: {len(category_cases)} cases from {len(seminars)} seminars")
            return category_cases
            
        except Exception as e:
            print(f"❌ Error scraping category {category['name']}: {e}")
            return []
    
    def get_seminars_from_category(self):
        """Get all seminars from the current category page"""
        seminars = []
        try:
            # Look for seminar links - they follow the pattern "/collection/sem{number}/"
            seminar_links = self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/collection/sem']")
            
            for link in seminar_links:
                href = link.get_attribute('href')
                title = link.text.strip()
                
                if title and href:
                    seminars.append({
                        'title': title,
                        'url': href,
                        'seminar_id': self.extract_seminar_id(href)
                    })
            
            # Remove duplicates
            seen_urls = set()
            unique_seminars = []
            for seminar in seminars:
                if seminar['url'] not in seen_urls:
                    seen_urls.add(seminar['url'])
                    unique_seminars.append(seminar)
            
            print(f"      Found {len(unique_seminars)} seminars in this category")
            return unique_seminars
            
        except Exception as e:
            print(f"      ⚠️ Error getting seminars: {e}")
            return []
    
    def extract_seminar_id(self, url):
        """Extract seminar ID from URL"""
        try:
            # URLs are like "https://rosaicollection.net/collection/sem1454/"
            import re
            match = re.search(r'/sem(\d+)/', url)
            if match:
                return match.group(1)
            return None
        except:
            return None
    
    def scrape_seminar(self, seminar, category_name):
        """Scrape all cases from a specific seminar"""
        try:
            # Navigate to seminar page
            self.driver.get(seminar['url'])
            time.sleep(3)
            
            seminar_cases = []
            
            # Look for the casegrid divs that contain the slides
            case_grids = self.driver.find_elements(By.CSS_SELECTOR, ".casegrid")
            
            print(f"      Found {len(case_grids)} cases in seminar")
            
            for i, case_grid in enumerate(case_grids):
                try:
                    case_data = self.extract_case_from_grid(case_grid, seminar, category_name, i)
                    if case_data:
                        # Check for duplicates
                        case_url = case_data.get('slide_url', '')
                        if case_url and case_url not in self.seen_case_urls:
                            self.seen_case_urls.add(case_url)
                            seminar_cases.append(case_data)
                        
                except Exception as e:
                    print(f"         ⚠️ Error extracting case {i+1}: {e}")
                    continue
            
            return seminar_cases
            
        except Exception as e:
            print(f"      ❌ Error scraping seminar: {e}")
            return []
    
    def extract_case_from_grid(self, case_grid, seminar, category_name, case_index):
        """Extract case data from a casegrid element"""
        try:
            case_data = {
                'category': category_name,
                'seminar_title': seminar['title'],
                'seminar_id': seminar['seminar_id'],
                'seminar_url': seminar['url'],
                'case_index': case_index + 1,
                'diagnosis': '',
                'location': '',
                'case_id': '',
                'slide_url': '',
                'thumbnail_url': '',
                'metadata': {}
            }
            
            # Extract slide URL (the main link)
            try:
                link = case_grid.find_element(By.TAG_NAME, "a")
                slide_url = link.get_attribute('href')
                case_data['slide_url'] = slide_url
                
                # Extract case ID from URL
                # URLs are like "https://rosai.secondslide.com/sem1454/sem1454-case1.svs"
                if slide_url:
                    import re
                    match = re.search(r'/sem(\d+)-case(\d+)\.svs', slide_url)
                    if match:
                        sem_id, case_num = match.groups()
                        case_data['case_id'] = f"{sem_id}-{case_num}"
                
            except:
                pass
            
            # Extract thumbnail image
            try:
                img = case_grid.find_element(By.TAG_NAME, "img")
                thumbnail_url = img.get_attribute('src')
                alt_text = img.get_attribute('alt')
                
                case_data['thumbnail_url'] = thumbnail_url
                
                # Parse the alt text which contains diagnosis and location
                # Format: "Hemangioendothelioma sarcoma (Spleen) [1454/1]"
                if alt_text:
                    case_data['diagnosis'] = alt_text
                    
                    # Try to extract location from parentheses
                    import re
                    location_match = re.search(r'\(([^)]+)\)', alt_text)
                    if location_match:
                        case_data['location'] = location_match.group(1)
                    
                    # Clean up diagnosis (remove location and case number)
                    diagnosis_clean = re.sub(r'\s*\([^)]+\)\s*\[\d+/\d+\]', '', alt_text).strip()
                    case_data['diagnosis_clean'] = diagnosis_clean
                
            except:
                pass
            
            # Extract description text
            try:
                description = case_grid.find_element(By.TAG_NAME, "p")
                if description:
                    case_data['description'] = description.text.strip()
            except:
                pass
            
            # Only return if we have meaningful data
            if case_data['slide_url'] or case_data['diagnosis']:
                # Debug output for first few cases
                if case_index < 3:
                    diagnosis = case_data.get('diagnosis_clean', case_data.get('diagnosis', 'Unknown'))[:50]
                    location = case_data.get('location', 'Unknown location')
                    print(f"         Case {case_index + 1}: {diagnosis} ({location})")
                
                return case_data
            
            return None
            
        except Exception as e:
            print(f"         ⚠️ Error extracting case data: {e}")
            return None
    
    def scrape_all_categories(self, specific_categories=None, max_categories=None):
        """Main scraping function for all categories"""
        print("=== Rosai Collection Scraper ===\n")
        print("🎯 Target: Historical pathology slide seminars from Juan Rosai Collection")
        print("📋 Features: Seminars, cases, virtual slides, and thumbnails")
        print("🔗 No login required - public collection")
        print()
        
        # Get all categories
        categories = self.get_categories()
        if not categories:
            print("❌ No categories found")
            return []
        
        # Filter categories if specific ones are requested
        if specific_categories:
            categories = [cat for cat in categories if cat['name'] in specific_categories]
            print(f"🎯 Filtering to specific categories: {specific_categories}")
        
        # Limit categories for testing
        if max_categories:
            categories = categories[:max_categories]
            print(f"🧪 Testing with first {len(categories)} categories")
        
        total_cases = 0
        total_seminars = 0
        
        print(f"\n🚀 Starting to scrape {len(categories)} categories...")
        
        for i, category in enumerate(categories, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(categories)}] Processing: {category['name']} ({category['count']} slides)")
            print(f"{'='*60}")
            
            try:
                # Scrape this category
                category_cases = self.scrape_category(category)
                
                # Add to global collection
                self.all_cases.extend(category_cases)
                
                # Count seminars in this category
                seminars_in_category = len(set(case['seminar_id'] for case in category_cases if case.get('seminar_id')))
                
                total_cases += len(category_cases)
                total_seminars += seminars_in_category
                
                print(f"\n📊 {category['name']} Summary:")
                print(f"   - Cases: {len(category_cases)}")
                print(f"   - Seminars: {seminars_in_category}")
                print(f"   - Running total: {total_cases} cases from {total_seminars} seminars")
                
                # Be respectful between categories
                time.sleep(3)
                
            except Exception as e:
                print(f"   ❌ Error processing {category['name']}: {e}")
                continue
        
        # Save final results
        self.save_results()
        
        return self.all_cases
    
    def save_results(self):
        """Save comprehensive results to JSON file"""
        output_file = 'rosai_collection_complete.json'
        
        try:
            # Add final metadata to each case
            for case in self.all_cases:
                case['has_slide_url'] = bool(case.get('slide_url'))
                case['has_thumbnail'] = bool(case.get('thumbnail_url'))
                case['collection'] = 'Rosai Collection'
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.all_cases, f, indent=2, ensure_ascii=False)
            
            print(f"\n{'='*60}")
            print(f"🎉 ROSAI COLLECTION SCRAPING FINISHED!")
            print(f"{'='*60}")
            print(f"📁 Saved {len(self.all_cases)} cases to {output_file}")
            
            # Comprehensive statistics
            categories_processed = len(set(case['category'] for case in self.all_cases))
            seminars_processed = len(set(case['seminar_id'] for case in self.all_cases if case.get('seminar_id')))
            cases_with_slides = sum(1 for case in self.all_cases if case.get('slide_url'))
            cases_with_thumbnails = sum(1 for case in self.all_cases if case.get('thumbnail_url'))
            cases_with_diagnosis = sum(1 for case in self.all_cases if case.get('diagnosis'))
            
            print(f"📊 FINAL COMPREHENSIVE SUMMARY:")
            print(f"   - Categories processed: {categories_processed}")
            print(f"   - Seminars processed: {seminars_processed}")
            print(f"   - Total cases: {len(self.all_cases)}")
            print(f"   - Cases with slide URLs: {cases_with_slides}")
            print(f"   - Cases with thumbnails: {cases_with_thumbnails}")
            print(f"   - Cases with diagnosis: {cases_with_diagnosis}")
            print(f"   - Unique slide URLs: {len(self.seen_case_urls)}")
            
            # Category breakdown
            print(f"\n📋 Category Breakdown:")
            category_counts = {}
            for case in self.all_cases:
                cat = case['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            for category, count in sorted(category_counts.items()):
                print(f"   - {category}: {count} cases")
            
            # Show sample cases
            if len(self.all_cases) > 0:
                print(f"\n📋 Sample cases:")
                for case in self.all_cases[:10]:
                    diagnosis = case.get('diagnosis_clean', case.get('diagnosis', 'Unknown'))[:60]
                    location = case.get('location', 'Unknown')
                    seminar = case.get('seminar_title', 'Unknown seminar')[:40]
                    print(f"   - {case['category']}: {diagnosis} ({location})")
                    print(f"     📋 From: {seminar}")
                    if case.get('slide_url'):
                        print(f"     🔗 Slide: {case['slide_url']}")
            
            # Save detailed stats
            stats_file = 'rosai_collection_stats.json'
            stats = {
                'collection_name': 'Juan Rosai Collection',
                'collection_url': 'https://rosaicollection.net',
                'categories_processed': categories_processed,
                'seminars_processed': seminars_processed,
                'total_cases': len(self.all_cases),
                'cases_with_slides': cases_with_slides,
                'cases_with_thumbnails': cases_with_thumbnails,
                'cases_with_diagnosis': cases_with_diagnosis,
                'unique_slide_urls': len(self.seen_case_urls),
                'category_breakdown': category_counts,
                'scraping_timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            print(f"📈 Detailed stats saved to {stats_file}")
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")

def main():
    """Main function"""
    print("Rosai Collection Scraper v1.0")
    print("=============================")
    print("🎯 Scrapes historical pathology slides from Juan Rosai Collection")
    print("📋 Features: All categories, seminars, virtual slides, thumbnails")
    print("🔗 Public collection - no login required")
    print("📚 Source: https://rosaicollection.net")
    print()
    
    print("Choose scraping mode:")
    print("1. Test mode (first 3 categories)")
    print("2. Complete scrape (ALL categories)")
    print("3. Specific categories (e.g., just Skin, Breast)")
    print("4. Custom number of categories")
    
    try:
        choice = input("\nEnter choice (1-4): ").strip()
        
        specific_categories = None
        max_categories = None
        
        if choice == "1":
            max_categories = 3
            print("🧪 Test mode: Will scrape first 3 categories")
        elif choice == "2":
            max_categories = None
            print("🚀 COMPLETE mode: Will scrape ALL categories")
            confirm = input("This will scrape ALL 19 categories. Continue? (y/n): ").strip().lower()
            if confirm not in ['y', 'yes']:
                print("Cancelled.")
                return
        elif choice == "3":
            categories_input = input("Enter categories separated by commas (e.g., Skin, Breast, Bone): ").strip()
            specific_categories = [cat.strip() for cat in categories_input.split(',')]
            print(f"🎯 Will scrape specific categories: {specific_categories}")
        elif choice == "4":
            max_categories = int(input("Enter number of categories to scrape: "))
            print(f"🔢 Will scrape first {max_categories} categories")
        else:
            print("Invalid choice, using test mode")
            max_categories = 3
        
        # Ask about headless mode
        headless_choice = input("\nRun in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        print(f"\n🚀 Starting Rosai Collection Scraper...")
        print(f"   - Target: Historical pathology slides")
        print(f"   - Mode: {'Headless' if headless else 'Visible browser'}")
        if specific_categories:
            print(f"   - Categories: {specific_categories}")
        elif max_categories:
            print(f"   - Max categories: {max_categories}")
        else:
            print(f"   - Max categories: All available")
        print()
        
        # Create scraper and run
        scraper = RosaiCollectionScraper(headless=headless)
        results = scraper.scrape_all_categories(
            specific_categories=specific_categories,
            max_categories=max_categories
        )
        
        print(f"\n🎯 MISSION ACCOMPLISHED!")
        print(f"📊 Successfully scraped {len(results)} historical cases from Rosai Collection!")
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n👋 Done!")

if __name__ == "__main__":
    main()