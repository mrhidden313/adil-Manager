export function ripple(node: HTMLElement) {
    function handleClick(e: MouseEvent) {
        // Create the ripple element
        const circle = document.createElement('span');
        const rect = node.getBoundingClientRect();
        
        // Calculate size based on the furthest corner from the click
        const diameter = Math.max(rect.width, rect.height) * 1.5;
        const radius = diameter / 2;
        
        // Set position relative to the click coordinates
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${x - radius}px`;
        circle.style.top = `${y - radius}px`;
        circle.classList.add('liquid-ripple');
        
        // Remove old ripples to prevent DOM buildup if clicked rapidly
        const existingRipple = node.querySelector('.liquid-ripple');
        if (existingRipple) {
            existingRipple.remove();
        }
        
        node.appendChild(circle);
        
        // Clean up the ripple after animation completes
        setTimeout(() => {
            circle.remove();
        }, 800);
    }
    
    // Ensure the node can contain the absolute-positioned ripple
    const computedStyle = window.getComputedStyle(node);
    if (computedStyle.position === 'static') {
        node.style.position = 'relative';
    }
    node.style.overflow = 'hidden';
    
    node.addEventListener('mousedown', handleClick);
    // Also support touch for mobile
    node.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const mockEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            } as MouseEvent;
            handleClick(mockEvent);
        }
    }, { passive: true });
    
    return {
        destroy() {
            node.removeEventListener('mousedown', handleClick);
            node.removeEventListener('touchstart', handleClick as any);
        }
    };
}
